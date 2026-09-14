# Plan Review Log: NDS / SDPWS QAQC of the stacked headers/studs and stacked shearwall calculators
Act 1 (grill) complete — plan locked with the user 2026-09-14. MAX_ROUNDS=5.
PLAN_FILE=PLAN-STACKED-WOOD-QAQC.md  LOG_FILE=PLAN-STACKED-WOOD-QAQC-REVIEW-LOG.md

## Round 1 — Codex

1. **Phase 1 is not actually review-only:** it proposes creating a report and possibly a Python script, contradicting “no calc files change” and the user-facing implication of no repository mutation.  
Fix: Define Phase 1 as “no production calculator changes” and explicitly authorize only the named report/test artifacts.

2. **The code-source plan depends on PDFs outside the repository without verifying that those paths exist or are accessible.**  
Fix: Add a prerequisite that resolves and records each exact code-document path and edition before review starts, with a blocking fallback if unavailable.

3. **“Section text verbatim” creates copyright and transcription risk and is unnecessary for QAQC traceability.**  
Fix: Record section/table/equation identifiers plus short paraphrases and limited excerpts instead of copying code text wholesale.

4. **The ASCE 7 ASD combination list is incomplete as a general envelope:** rain `R` is omitted, earthquake combinations are omitted for gravity/member checks, and the five-value `C_D` mapping does not unambiguously map to the six listed combinations.  
Fix: Define a machine-readable combination table covering applicable `Lr/S/R`, wind, earthquake, uplift, signs, and the exact `C_D` assigned to every combination.

5. **The plan treats `D+L` and `D+S` as universal cases without distinguishing floor live load, roof live load, snow, and mutually exclusive/transient roof actions by level.**  
Fix: Give every load component an explicit type and story source, then generate only code-applicable combinations at each floor.

6. **“Use max(Lr,S), never both” is too simplistic because rain must also participate and differing tributary areas or load patterns can prevent a scalar maximum from representing the governing effect.**  
Fix: Envelope separate `Lr`, `S`, and `R` effect cases instead of replacing them with one input-level maximum.

7. **The plan does not define whether lateral signs are enveloped; `0.6D±0.6W` and `0.6D±0.7E` require reversal, particularly for hold-downs and uplift.**  
Fix: Evaluate both lateral directions and report the governing end/chord rather than using unsigned positive shear only.

8. **The proposed shearwall input semantics are dangerously ambiguous:** the current UI says each `V_floor` is diaphragm shear delivered at that level, while the engine sums unit shears from upper floors even when `C_oΣL_i` differs by story.  
Fix: Specify whether inputs are incremental level forces or already-accumulated story shears, then accumulate forces first and divide by the current story’s effective wall length—never sum plf values with different denominators.

9. **Applying `0.6W` or `0.7E` internally can double-reduce loads imported from analysis if they are already ASD-level story shears.**  
Fix: Store an explicit load-basis discriminator (`strength`, `ASD`, or imported-combination result) and reject ambiguous legacy/imported values.

10. **The plan conflates sheathing conversion factors with complete wind/seismic load combinations; dead load does not alter sheathing shear demand but materially affects chord uplift.**  
Fix: Define separate demand pipelines for unit shear, overturning uplift, and anchorage, each with its applicable ASCE combination.

11. **The header engine’s accumulation is label-based and only follows the immediately preceding floor; duplicate labels, skipped floors, renamed openings, and discontinuous stack geometry can silently misroute or drop loads.**  
Fix: Replace label matching with stable stack/member IDs and validate continuity, duplicates, offsets, and missing intermediate supports.

12. **The proposed state work cites `docs/calc-state-spec.md`, but that contract explicitly covers only three steel calculators and its schema discriminator excludes both wood slugs.**  
Fix: Create a dedicated, authoritative wood-calc state schema or formally extend the central schema and examples before implementing migration.

13. **Both calculators already have independent version-1 persistence paths:** AREv2 adapters exist in both, and the shearwall also has its own JSON export/import format. The plan mentions only one generic migration.  
Fix: Inventory and test migrations for Tier-A fields, Tier-B adapter models, shearwall project JSON, foundation export payloads, and any server-saved envelopes separately.

14. **“Frozen saved records must not silently re-run” conflicts with each adapter’s current `runAndSettle: render()` behavior and with restoring editable inputs into a new engine.**  
Fix: Define immutable result snapshots containing engine version/code edition and require an explicit “recalculate with current engine” action that creates a new revision.

15. **Changing the adapter version alone will not preserve old results because current saves primarily preserve inputs/model state, not a pinned executable or authoritative computed result set.**  
Fix: Persist normalized inputs, complete result/check snapshots, engine build/version, references, and migration provenance as separate fields.

16. **The plan does not address the existing header-to-foundation export contract, whose payload uses lowest-floor accumulated plf values and will change under the new combination envelope.**  
Fix: Version `areCalcs_foundationExport`, export separated load components and governing combinations, and retain a legacy reader/migration.

17. **The proposed blanket 48-inch weak-axis effective length is an engineering assumption, not proof of bracing adequacy; sheathing installation, fastening, blocking continuity, construction stage, and compression-edge restraint all matter.**  
Fix: Make bracing condition and effective length explicit per member/story, validate the physical restraint system, and default to unbraced unless a qualifying condition is selected.

18. **A per-row “unbraced override” is underspecified because the relevant unbraced length and axis differ for jambs, kings, and common studs.**  
Fix: Store and display independent strong- and weak-axis effective lengths or bracing spacings for each member check.

19. **The current `calcCP` silently clamps `l_e/d` to 50; the plan notices the masking but never explicitly requires rejection of out-of-scope slender columns.**  
Fix: Remove the clamp and produce a hard applicability failure when the NDS slenderness limit is exceeded.

20. **The plan says `C_P = min` of axis results but does not preserve the axis-specific `F_cE` needed in the NDS beam-column interaction denominator.**  
Fix: Compute and retain `C_P`, `F_cE`, slenderness, and interaction terms independently by axis, using the buckling axis corresponding to each bending case.

21. **The king-stud wind model remains poorly defined:** the existing engine converts an opening tributary-area load into a point load at an arbitrary opening-head elevation and clamps invalid geometry to `0.9L`.  
Fix: Define the actual distributed/point-load model and support locations, reject impossible opening geometry, and fixture-test moment diagrams for top-, middle-, and full-height openings.

22. **King-stud axial demand is described as “header reaction” but the engine passes only current-row jamb total; the plan does not state which accumulated reaction components act concurrently with wind.**  
Fix: Build king axial demand from explicitly traced reactions and evaluate it under each concurrent ASCE combination rather than applying `C_D=1.6` to an undifferentiated gravity total.

23. **The repetitive-member factor decision is incomplete:** eligibility depends on member count, spacing, and load-distributing elements, not merely whether the checked object is called a stud.  
Fix: Add an eligibility predicate with documented member count, spacing, and load-distribution assumptions; otherwise use `C_r=1.0`.

24. **Header lateral stability cannot be represented adequately by one “top edge braced” checkbox; restraint must satisfy NDS beam-stability requirements along the compression edge and at supports.**  
Fix: Replace the checkbox with explicit restraint conditions or conservative unbraced-length input and calculate `l_u/l_e` from the selected loading/restraint case.

25. **The plan assumes one `l_e = 1.63l_u+3d` form, but NDS effective beam length depends on loading and support conditions.**  
Fix: Enumerate supported beam/loading cases, use the corresponding Table 3.3.3 effective length, and reject unsupported arrangements.

26. **Multi-ply headers are treated as a monolithic section, but the plan does not add a load-sharing/ply-connection check ensuring all plies receive the assumed load.**  
Fix: Add a required ply-fastening/load-transfer design or clearly limit the calculator to externally distributed loading that demonstrably loads every ply.

27. **Bearing “per jamb count with `C_b`” is too vague and can be wrong:** bearing area depends on actual contact length and header width, while `C_b` has applicability and spacing/end-distance conditions.  
Fix: Input or derive actual bearing length, enforce `C_b` applicability limits, and check both header compression perpendicular to grain and supporting jamb/post load transfer.

28. **No crushing/bearing check is planned at stud/jamb ends, plates, or concentrated header reactions beyond the header’s own `F_c⊥` check.**  
Fix: Add all applicable compression-perpendicular-to-grain interfaces, including plates and reaction transfer paths, with species-specific values and factors.

29. **Header deflection is mentioned without criteria, load cases, creep, or serviceability basis.**  
Fix: Define total-load, live-load, and roof-load limits; include applicable `K_cr`/long-term effects and clearly identify project-selectable criteria.

30. **Common-stud serviceability remains missing even though wind bending is checked; strength-only acceptance can permit excessive wall deflection and cladding distress.**  
Fix: Add transverse wind deflection checks with an explicit service-level pressure and project-selectable limit.

31. **The plan does not address eccentricity from header reactions delivered to multi-stud jamb packs or eccentric wall loading.**  
Fix: State and validate concentric-load assumptions or add eccentric axial/bending interaction where the load path is not concentric.

32. **The shearwall plan lists aspect-ratio reduction but not how multiple full-height segments with different widths are represented; the current model stores only aggregate `ΣL_i`.**  
Fix: Replace aggregate `Li` with an array of segment widths so each segment is checked/reduced before summation.

33. **An aggregate `Li` cannot verify the `h/b_s` limit, identify ineligible segments, or apply segment-specific capacity reductions.**  
Fix: Require every full-height segment geometry and compute effective length/capacity segment by segment.

34. **The plan does not define mixed sheathing, different faces, blocked/unblocked construction, panel grade, framing species, fastener diameter, or fastener spacing constraints.**  
Fix: Model the actual SDPWS table selectors and compatibility rules instead of a single coarse sheathing ID.

35. **The proposed two-sided rules are only a review bullet and are not explicitly included in Phase 2 implementation scope.**  
Fix: Add two-sided capacity compatibility and framing/fastener limitations as required engine checks with fixtures.

36. **The 0.92 factor is framed too narrowly; applicability depends on the exact sheathing/fastener/end-post/hold-down configuration and must not be inferred from a generic “10d” entry.**  
Fix: Encode the complete SDPWS applicability predicate and show which condition triggered the factor.

37. **Gypsum is retained in the same perforated-wall selection list without first proving that the chosen seismic system, height, and method permit it.**  
Fix: Add material/system-specific seismic eligibility and height limitations, disabling configurations outside SDPWS scope.

38. **Shearwall deflection/drift is explicitly out of scope even though a code-compliance conclusion for multi-story shearwalls is impossible without deformation and story-drift compatibility.**  
Fix: Either add SDPWS shearwall deflection/drift checks or narrow the deliverable to strength-only component checks and prohibit a blanket “code compliant” verdict.

39. **Collectors are partly declared out of scope while the plan intends to claim load-path compliance and check sill anchorage; the boundary between wall-line transfer and external collectors is undefined.**  
Fix: Define load-path boundaries precisely and produce an explicit unresolved-design warning for collector/diaphragm transfer forces.

40. **Chord/post compression, net section, stud-pack capacity, and load transfer at floor lines are absent despite hold-down selection depending on an adequate chord system.**  
Fix: Add chord/post tension-compression and interstory transfer checks or label hardware selection as incomplete and non-designing.

41. **Hold-down lookup by `Tall >= T` ignores post species/size, fastener installation, anchor rod steel, concrete anchorage, eccentricity, deflection, and catalog footnotes.**  
Fix: Gate each hardware capacity on all catalog prerequisites and separately check the anchor and supporting material rather than treating the catalog row as a complete assembly capacity.

42. **“Hardware on DF/SP basis, `C_D=1.6`” is not generally valid because published allowable values may already embed adjustment limits and some steel-governed capacities cannot receive a duration increase.**  
Fix: Record whether each published value is wood-, fastener-, or steel-governed and apply only manufacturer-permitted adjustments.

43. **A “current Simpson catalog online” reference makes fixtures nondeterministic and may mismatch the project’s adopted code/evaluation-report edition.**  
Fix: Pin an exact catalog/ESR revision and archive its citation metadata; treat later editions as an explicit update.

44. **The proposed NDS Chapter 12 anchor-bolt calculation is not a complete wood-to-concrete anchorage design and may misapply dowel-yield equations to a foundation anchor condition.**  
Fix: Define the applicable connection model and separately check wood bearing/yield, bolt steel, concrete breakout/pryout, edge distance, spacing, washers, plate splitting, and code jurisdiction—or keep foundation anchorage out of scope.

45. **The plan supplies fixed sill thickness/species assumptions but the UI permits broader wall configurations and does not capture moisture, incising, end grain, edge distances, or anchor layout.**  
Fix: Add all connection inputs governing NDS factors and geometry, with hard applicability validation.

46. **The overturning review still starts from the suspect `T = M/(C_oΣL_i)` formulation; effective shear length is not automatically the chord lever arm.**  
Fix: Compute overturning moment independently and divide by the actual chord-centroid spacing, treating `C_o` only where SDPWS explicitly requires it.

47. **The existing dead-load calculation mixes a `0.6`-factored distributed term with an unfactored `dl_override`, so the review needs a specific unit/factor audit that the plan does not call out.**  
Fix: Store unfactored dead-load components consistently, apply `0.6D` once to all resisting dead load, and distinguish force from moment inputs.

48. **Negative net overturning can produce negative `T`, which the current lookup would incorrectly satisfy with the smallest hold-down; the plan does not mention clamping or opposite-end action.**  
Fix: Evaluate both directions/end chords and use nonnegative tension demand per end, while separately reporting compression.

49. **The plan does not require input-domain validation for zero/negative lengths, `Li>L`, opening heights exceeding story height, NaN values, zero spacing, or missing wall lines.**  
Fix: Add centralized schema and semantic validation with blocking errors before any computation.

50. **Fallback behavior is unsafe:** the shearwall engine silently substitutes a default sheathing when an ID is unknown and substitutes walls by array position when a matching wall is absent.  
Fix: Remove engineering fallbacks and fail loudly on unknown IDs or discontinuous wall-line mappings.

51. **Wall lines are correlated across floors by array index, so adding/reordering walls can combine unrelated walls in cumulative shear and overturning.**  
Fix: Use stable wall-line IDs and require explicit vertical continuity/transfer definitions.

52. **The planned fixtures are too sparse:** “one reference case per calc” cannot cover multiple combinations, axes, species, openings, story discontinuities, and hardware branches.  
Fix: Build a coverage matrix with boundary, invalid-input, reversal, discontinuity, migration, and every governing-limit-state fixture.

53. **A 1% comparison tolerance is too loose for deterministic arithmetic and too blunt for tabulated rounding or code-example approximations.**  
Fix: Use tight numerical tolerances for engine math and separately documented acceptance tolerances for rounded published examples.

54. **Fixtures “hand-derived” during the same fix effort are vulnerable to reproducing the implementation’s mistakes.**  
Fix: Store independent expected values with derivation provenance and require review of fixture calculations before engine code is accepted.

55. **The Playwright template only checks rendering, row counts, and page errors; it does not validate persistence, migration, exact results, invalid inputs, print output, or stale result behavior.**  
Fix: Add assertions for normalized engine outputs, state round-trips, old-version migrations, snapshot/recalculation behavior, validation errors, and export contracts.

56. **`?selftest=1` plus `window.*` engines exposes no guarantee that production and fixtures execute the identical code path.**  
Fix: Put pure engines in importable modules consumed by both the page and Node tests, leaving only a thin DOM adapter in the HTML.

57. **Two globals (`window.HDR` and `window.SW`) are a simpler extraction than the current monolith but still hinder static typing, schema validation, and server-side reuse.**  
Fix: Prefer shared ES modules with typed input/output contracts and use window shims only for legacy browser integration.

58. **The plan delays engine extraction until after sign-off, making Phase 1’s “independent comparison to the live calc” dependent on scraping or duplicating opaque DOM-coupled logic.**  
Fix: Permit a behavior-preserving pure-engine extraction first, verify parity against the old UI, then perform the engineering review and gated corrections.

59. **Status is not switched to `wip` until Phase 2 even though known suspect values and potentially unsafe calculations remain publicly marked `ready` throughout review.**  
Fix: Mark both calculators `wip` or add a prominent unverified warning at the start of Phase 1.

60. **The deploy step assumes `/tmp/are-git`, which is a Unix path inconsistent with the Windows workspace and is not verified anywhere in the plan.**  
Fix: Replace it with a repository-specific documented deployment command/path discovered and validated before implementation.

61. **The plan includes editing a Word master outside the stated repository scope and backup conventions but does not require the document render-and-verify workflow.**  
Fix: Separate that external-document change into an explicitly authorized task with exact path, recoverable backup, changelog entry, and rendered visual QA.

62. **The general note imposes temporary-construction bracing, but a design calculator cannot establish contractor sequencing or temporary stability merely through a note.**  
Fix: Separate permanent design bracing assumptions from contractor temporary-bracing requirements and require project-specific confirmation.

63. **The final “flip ready and deploy” gate lacks an independent engineering approval record after fixes are implemented.**  
Fix: Require post-fix calculation review/sign-off, fixture evidence, migration evidence, and a release checklist before restoring `ready`.

VERDICT: REVISE

### Claude's response (round 1) — plan Rev. 2

**Accepted and folded into the plan (by Codex item number):**
1, 2, 3 — Phase 1 wording: no production calc changes; code PDF paths recorded (already verified on the server this session); identifiers + short excerpts instead of verbatim code text.
4, 5, 6 — Machine-readable combination table with explicit C_D per row (incl. D at 0.9, Lr at 1.25); Lr and S as separate enveloped effect cases; load components typed by story of origin. Rain: not an input of this calculator, stated as out of scope (see rejected 6 below).
7, 48 — Both lateral directions, both ends, T = max(0, ...), compression reported separately.
8 — Confirmed in code (`v_total` loop sums plf with per-floor C_o·L_i denominators). Inputs defined as incremental story forces; forces accumulated first, divided by the current story's C_o ΣL_i.
9, 11, 51 — `load_basis` discriminator; legacy `V_floor` blocks until re-assigned; stable IDs for wall lines and header stacks; continuity validation.
10 — Separate pipelines: unit shear (no D), uplift (0.6D), anchorage.
12, 13, 14, 15, 16 — Persistence inventory (AREv2 adapters v1, shearwall JSON v1, foundation export payload, frozen record files). Frozen records are post-run DOM files written by are-utils-v2.js and never re-run, so "silent re-run" is narrower than stated; adopted result snapshots with engine/code/catalog versions, banner on legacy load, foundation export v2 with v1 reader, calc-state-spec extended first.
18, 19, 20 — Both axes computed and retained (slenderness, F_cE, C_P); clamp removed, l_e/d > 50 hard failure; strong-axis F_cE1 in the interaction denominator.
21, 22 — King wind model defined (uniform over story height, trib = opening/2 + spacing/2, no 0.9L clamp, geometry validation); king axial = stud tributary gravity, jambs take the header reaction.
23 — C_r eligibility predicate; C_r = 1.0 for kings and jambs.
24, 25 — Table 3.3.3 l_e by l_u/d band; continuously-braced compression edge (§3.3.3.3 / §4.4.1.2) instead of a bare checkbox.
27, 28 — Header end bearing: C_b = 1.0 (end bearing, §3.10.4 not applicable); bearing area from jamb count; plate Fc-perp interface under the jamb pack added.
29, 30 — Deflection criteria per IBC 2021 Table 1604.3 (L/360 live, L/240 total with 0.5D wood creep footnote; H/240 or H/120 at 0.42W for studs).
32, 33 — Segment width arrays replace aggregate ΣL_i; per-segment aspect ratio and 2b_s/h.
34 (partial), 35, 36, 37 — Sheathing selector carries the SDPWS table selectors and blocked construction; framing-species SG factor; two-sided rules as Phase 2 checks; 0.92 factor encoded as its full predicate; gypsum seismic eligibility gated on SDC/height with an SDC input.
38, 39 — Compliance verdict narrowed to strength-level component checks; drift stays out of scope and the report says so; collector force emitted as an unresolved-design warning.
40, 41 (partial) — End-post compression and net-section checks added; hold-down look-up gated on the catalog post-size prerequisite; anchor rod / concrete anchorage explicitly out of scope.
42, 43 — Simpson "160" column already includes C_D 1.6, no further adjustment, governing mode recorded; catalog edition and ESRs pinned.
44, 45 (partial) — Anchor bolt limited to NDS Table 12E wood-side yield with §12.5 geometry minima and selectable sill species; concrete breakout out of scope by statement. Moisture / incising fixed as dry, non-incised (stated), not made inputs.
47 — Dead-load unit/factor audit of `0.6*DL` vs unfactored `dl_override` added to item 10.
49, 50 — Central validation; no engineering fallbacks.
52, 53, 54, 55, 56 — Coverage matrix; 1e-6 engine tolerance vs ≤1 % for rounded published examples; expected values derived in Phase 1 before engine code; Playwright asserts outputs, round-trips, migrations, validation, print, export; engines in shared files loaded by page and Node.
61 — TIMBER master edit via docx skill with backup, changelog, rendered check.
62 (wording) — Two notes: permanent design assumption vs contractor requirement.
63 — Post-fix review record and sign-off line before `ready`.

**Rejected, with reason:**
6 (rain) — R is not an input of this calculator and adding it widens scope; recorded as an out-of-scope statement in the notes rather than a new load type.
17 — Blanket 48 in. weak-axis bracing is the user's engineering decision (grill Q4), backed by a general note the drawings will carry; it is an input with an unbraced override, not a validated restraint system. Not the calculator's job to prove the contractor's bracing.
26 — Multi-ply fastening design is out of scope; the top-plate-loads-every-ply assumption is stated in the notes.
31 — Eccentric jamb loading is out of scope; concentric assumption stated.
46 — For the perforated method SDPWS §4.3.6.4.1.1 gives T = V h / (C_o ΣL_i) directly; the chord-spacing lever arm is the segmented-wall form. Kept the code form; accepted the dead-load-as-force correction.
57 — ES modules with typed contracts: repo convention is static HTML with window adapters and Node `vm` loading; shared engine files already guarantee one code path (56 accepted). Typing is a separate refactor.
58 — Extracting engines before the review is a code change in a phase the user locked as review-only; the live-page Playwright comparison (WRI slab method) gives Phase 1 an independent read of the current engines without touching them.
59 — Status stays `ready` during review by the user's decision (grill Q10). Flagged in the resolution as Codex's counter-position.
60 — `/tmp/are-git` is a Git Bash path on this Windows machine and was verified in this session (`git --git-dir=/tmp/are-git config core.worktree` resolves to the OneDrive repo). Recorded in Phase 0.
62 (substance) — A calculator cannot enforce sequencing; the note is the user's chosen instrument. Wording split as accepted above.

## Round 2 — Codex

Rev. 2 addresses most round-one findings, particularly load-basis migration, stable IDs, force-first accumulation, validation, state-version conflicts, fixtures, and release evidence. Material issues remain:

1. **Gypsum remains eligible for the perforated shearwall method.** SDPWS perforated-wall provisions are limited to qualifying wood structural panel shearwalls; adding SDC and height gates does not make gypsum board eligible.  
Fix: Disable gypsum for the perforated method, or add a separate code-supported design method instead of processing it through `C_o`.

2. **The overturning notation can still cause double accumulation.** Item 10 defines `F_k` as accumulated story shear and then states the moment is `ΣF_j h_j`; if `F_j` means those accumulated shears, this differs from summing incremental level forces times their elevations.  
Fix: Define distinct symbols: incremental level force `P_j`, story shear `V_k=ΣP_j`, and base moment `M_k=ΣP_j z_{j,k}`—or the mathematically equivalent `ΣV_i h_i` story-by-story.

3. **Sheathing aspect-ratio treatment remains ambiguous.** “Apply `2b_s/h` before summation” does not say whether segment capacities, effective lengths, or both enter the perforated-wall equations, and risks applying the reduction twice through both `C_oΣL_i` and capacity.  
Fix: State the exact per-segment equation and how reduced segment capacity is combined, with a mixed-width fixture proving the reduction is applied exactly once.

4. **The seismic-system input is incomplete.** SDC alone is insufficient to apply ASCE 7 Table 12.2-1 height/system limits; eligibility also depends on the selected seismic-force-resisting system and associated table row.  
Fix: Add an explicit SFRS/system selection and map SDC plus system to the applicable height and material restrictions.

5. **The generic “net-section tension check at hold-down bolts” does not match all selected hardware.** HDUE devices use face fasteners and CMST straps use nails; neither necessarily creates a post bolt hole governed by one generic net-section model.  
Fix: Make end-post checks connector-specific—net section only where holes exist, plus applicable fastener-group, post splitting, minimum thickness/width, and catalog installation prerequisites.

6. **Hardware verification is narrower in Phase 2 than in Phase 1.** Item 12 says geometry minima and connector prerequisites will be verified, but item 19 only guarantees a hardware table, governing mode, post-size gate, and anchor-bolt derivation. Approved findings could therefore disappear between review and implementation.  
Fix: Make Phase 2 explicitly implement every applicable catalog/ESR prerequisite found in Phase 1, with a fixture for each hardware family.

7. **Result snapshots are underspecified.** The plan lists engine/code/catalog versions and governing combinations, but not complete per-check demand, capacity, D/C, status, inputs hash, or migration provenance; that is insufficient to reproduce what was accepted.  
Fix: Define the v2 snapshot schema to include normalized-input hash, all check results, assumptions, engine build identifier, references, migration source, and timestamp.

8. **The header deflection wording risks treating `0.5D` as the entire total-load case.** The IBC wood creep provision modifies how long-term dead-load deflection is accounted for; it does not replace the instantaneous total-load calculation with `0.5D`.  
Fix: Spell out the instantaneous and long-term deflection equations separately and verify the interpretation directly against IBC Table 1604.3 footnote d.

9. **The fixture matrix omits critical new branches.** It does not expressly cover two-sided dissimilar sheathing, the 0.92 predicate, gypsum rejection, framing-SG reduction, post prerequisite failures, or legacy foundation-export v1/v2 interoperability.  
Fix: Add those branches explicitly to the coverage matrix rather than relying on the general “each limit state” language.

VERDICT: REVISE

### Claude's response (round 2) — plan Rev. 3

All nine items accepted; two were verified against the SDPWS 2021 PDF before editing.

1 — Verified: SDPWS 2021 §4.3.2.3 requires perforated shear walls to be "sheathed on one or both sides with wood structural panel sheathing"; gypsum only as the opposite face per §4.3.5.4.2. Gypsum-only entries removed from the perforated selector; gypsum kept only as the WSP opposite face with the Table 4.3.3 note 2 wind-only 3.5:1 limit. Also enforced from §4.3.2.3: 2,435 plf nominal cap, 20 ft height cap, segment at each end, uniform sheathing. Section-number audit added (the page cites 2015 numbering).
2 — Symbols split: P_j incremental level force, V_k = Σ P_j, M_k = Σ P_j z_{j,k}; v_k and T_k defined from those.
3 — Verified: §4.3.3.4 multiplies the segment length by 2b_i/h for determining b_i and Σb_i; Commentary C4.3.5.6 says C_o uses A_fhs with no aspect-ratio adjustment. Plan now states the length reduction is the only entry point, capacity unreduced, with a mixed-width fixture.
4 — SFRS selection added (ASCE 7-16 Table 12.2-1 rows A.15 / B.22 WSP, A.16 / B.23 other materials) mapped with SDC to height and material limits.
5 — Generic net-section row dropped; connector-specific prerequisites (HDUE screws / post size; CMST nails / SG 0.50); net-section only for a bolted device, which the calc does not offer.
6 — Phase 2 item 19 now requires every Phase 1 hardware prerequisite and §12.5 minimum to be implemented with a fixture per hardware family.
7 — Snapshot schema defined (engine build id, codes, hardware edition, inputs hash, assumptions, full checks[], governing, migration provenance, timestamp).
8 — Deflection split into the live-load row and the instantaneous D + L total-load row; IBC footnote d 0.5D substitution only with a "dry at installation" option; NDS §3.5.2 K_cr informational.
9 — Coverage matrix lists the sheathing, hardware-prerequisite, and persistence branches explicitly.

Nothing rejected this round.

## Round 3 — Codex

Rev. 3 addresses all nine round-two findings. The revised plan now has sufficiently explicit equations, method eligibility, hardware branching, persistence metadata, and fixture coverage to implement safely.

One minor drafting issue is worth correcting during implementation: item 10 first states the single-story shorthand `T = Vh/(C_oΣL_i)` and then correctly defines the multi-story expression `T_k = M_k/(C_o,kΣb_i,k)`. Ensure UI details and tests use the latter for stacked walls and present the former only as a single-story special case. This is already substantively clear and is not material enough to block implementation.

VERDICT: APPROVED
### Claude's response (round 3)

Converged: VERDICT APPROVED in round 3 of MAX_ROUNDS=5. The one drafting note (item 10 single-story shorthand vs multi-story T_k) was applied to the plan: stacked walls use T_k = M_k / (C_o,k Σb_i,k) in the UI detail and tests; V h / (C_o Σb_i) is shown only as the one-story special case. Plan Rev. 3 (final) awaits Nick's sign-off before Phase 1 starts.


## Phase 1 — Review complete (2026-09-14)

Executed by six parallel subagents (A headers code audit, B shearwall code audit, C hardware, D shearwall recompute, E headers recompute, F edition deltas), Claude as final reviewer only. Integrated report: `docs/stacked-wood-qaqc-2026-09.md`; appendices in `docs/stacked-wood-qaqc-2026-09/`. No production calculator file changed (git status: only untracked plan/log/report files and two underscore-prefixed scratch harnesses in tools/).

Reviewer arbitration against the standard text: seismic ASD divisor 2.8 (SDPWS 2021 §4.1.4.1) — auditor D's "2.0 for both" rejected; uplift anchorage t = v_max (§4.3.6.4.2.1) — plan corrected; Table 3.3.3 uniform-load row has two branches (1.84 l_u is footnote 1) — auditor A's H-4 downgraded, plan corrected; ASCE 7-16 Table 12.2-1 wood rows A.15/A.17/B.22/B.24 — plan corrected.

Result: 19 header findings (6 SB, 5 MF, 7 SF, 1 D) and 21 shearwall findings (8 SB, 6 MF, 6 SF, 1 D). 29 expected-value fixtures with provenance. 15 decisions listed for Nick in report §5. Phase 2 does not start until Nick answers.

## Nick's Phase 1 decisions (2026-09-14) — Phase 2 authorized

1 wind: strength-level W typed, 0.6 applied in engine (C&C feed unchanged). 2 king axial = accumulated wall gravity plf × (stud spacing / 2) only; jambs take 100 % of the header reaction. 3 jamb strong-axis unbraced length = top-of-opening height (trimmer length); weak axis 48 in bracing input. 4 C_r 1.15 on wall studs at ≤ 24 in, predicate printed. 5 L_r and S kept as separate enveloped cases. 6 no issued project used either calculator; fix forward, no re-check list. 7 dead-load relief M_R = 0.6·w·L²/2 (uniform) + 0.6·P_D at the chord (point), unfactored inputs, both directions. 8 no legacy shearwall records exist — schema goes to v2, v1 files simply refused with a message, no migration UI. 9 KEEP gypsum: as the opposite face of a WSP wall per §4.3.5.4.2 (wind: sum of both faces; seismic: 2× smaller or the larger, whichever is greater), gypsum 3.5:1 wind-only aspect limit, SDC/height gates; coordinate the sheathing model accordingly. 10 Add Floor inserts at the top; explicit base level. 11 LTP4 = current catalog 715 lb (12–0.131×1.5 nails, G direction, C_D 1.6) with the 0.72 / 0.64 sheathing-thickness reduction; old 600/667 retired. 12 SDS 304 default, 400 when sill species is DF/SP. 13 anchor bolts from NDS Table 12E × 1.6 (1,040 / 1,488 lb), concrete anchorage out of scope. 14 always carry v_max to the floor below. 15 act on every finding. Execution: subagents, Claude reviews only.

## Phase 2 — Fix (2026-09-14, in progress)

Specs: `docs/superpowers/specs/2026-09-14-stacked-headers-fix.md`, `...-stacked-shearwall-fix.md`. Two implementer subagents (Opus) on disjoint files, each followed by a spec-compliance reviewer (Opus) and a code-quality reviewer (Sonnet); Claude arbitrated.
- Track B (shearwall): spec review found the implementer had dropped ESR-2330 Table 2B's 3 in post column and changed the default end post to (3) 2x6 — reviewer downloaded the ESR and extracted the full grid (HDUE3/5/7 full capacity at 3 in; HDUE13 11,900/12,950/13,110; HDUE17 16,040 / 17,685 at 6x6); fixed, default restored to (2) 2x6. Plate-washer note made unconditional at the base with the 400 plf edge clause gated. Quality review: approve with minor fixes (single V1 refusal constant, negative geometry rejected, guarded endPostCheck, sourced constants) — applied. Final: 177 fixture assertions, Playwright ALL PASS, appendix D Case 1 exact.
- Track A (headers): spec review required jamb auto-find to satisfy header end bearing (VF example sizes trimmers by bearing) — implemented via a bearing-driven minimum count; eq393 refuses unconditionally at f_c ≥ F_cE1; king wind no longer divided by king count; v1 banner resets; wording, dead branch, R_B n/a display. 321 fixture assertions, 61 Playwright checks. Re-review and quality review pending.
- General notes: TIMBER NOTES master rev 5 (notes 10–11 added; backup + changelog), verified from the rendered page.
- Controller: `app/lib/calcs.ts` wip + spec tag; `package.json` test scripts; `.gitignore` tools/_out; `docs/calc-state-spec.md` §9.
