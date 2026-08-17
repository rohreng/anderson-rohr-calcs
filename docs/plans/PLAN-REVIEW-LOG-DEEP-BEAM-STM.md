# Plan Review Log: Strut-and-Tie Deep Beam Calculator
Act 1 (grill) complete — plan locked with the user. MAX_ROUNDS=5.

## Round 1 — Codex
1. **The default load benchmark is internally inconsistent.** `1.2(5.525)+1.6(5.205)=14.958 klf` before self-weight; reaching `18.2 klf` requires 2.702 klf unfactored additional dead load, but the stated 14 ft wall and 24×24 grade beam do not establish that without wall thickness and tributary-height assumptions.  
   Fix: Publish a complete default-input table and an independently traceable load decomposition that reproduces exactly 18.2 klf.

2. **The proposed “direct-strut” force assembly does not demonstrate nodal equilibrium.** Splitting every load between both supports generates horizontal components that require explicit horizontal ties/struts at each load node; summing `R·cotθ` for crossing struts alone is not a valid general STM solution.  
   Fix: Define a statically admissible truss topology and solve joint equilibrium at every node before calculating member forces.

3. **The UDL model is discretization-dependent.** Two quarter-point resultants are not equivalent to a continuous fan model for strut forces, nodal stresses, or intermediate tie demand, and stating that maximum tie force is “insensitive” is unsupported.  
   Fix: Either derive an exact continuous-load fan solution or define a converged discretization with a documented error tolerance.

4. **The stated equation `T = R·cotθ` is only valid for a specific joint and force definition.** It cannot be applied independently to arbitrary reaction shares and then summed without consistent signs and topology.  
   Fix: Derive each member force from node equilibrium and reserve `R·cotθ` for the exact geometry where its assumptions hold.

5. **`jd ≈ 0.7h` is an unsupported model input, not a conservative rule.** A smaller lever arm increases tie demand but also changes strut angle, strut width, node geometry, and anchorage location; “conservative-adequate” cannot be asserted globally.  
   Fix: Determine chord centroids from entered reinforcement and construct compatible nodal-zone geometry, or strictly bound the calculator to a validated empirical geometry range.

6. **The 25° check does not validate the STM.** Meeting ACI’s minimum strut angle does not prove that the selected direct-strut topology, nodal dimensions, or assumed lever arm is admissible.  
   Fix: Treat 25° as one check among equilibrium, compatibility, node fit, strut fit, and reinforcement-layout checks—not as a model-validity guard.

7. **The deep-beam applicability check is incomplete.** Reporting only `ln/h ≤ 4` omits load/support geometry and the requirement that the region actually permits compression struts between applied loads and supports.  
   Fix: Check clear-span definition, load-face/support-face relationship, concentrated-load locations, and D-region boundaries explicitly.

8. **Strut capacity lacks a defined effective cross-sectional area.** `Fns` requires `Acs` normal to the strut, but the plan never defines strut width, thickness, bottle expansion, overlap, or truncation by nodal zones.  
   Fix: Construct strut boundaries from bearing/load-node dimensions and report the resulting perpendicular `Acs`.

9. **Node checks are reduced incorrectly to unspecified “face stresses.”** A valid nodal-zone check requires an equilibrium-compatible nodal geometry and stress on every relevant face, not merely reaction divided by pier area.  
   Fix: Generate hydrostatic or extended nodal zones and check each face using its actual force and effective area.

10. **Automatic classification of all load nodes as CCC is wrong.** A load node may include a top tie, anchorage force, distributed reinforcement force, or a cantilever tension chord and therefore may be CCT or CTT.  
    Fix: Classify nodes from the solved forces entering each node rather than from their location.

11. **A support node is not automatically CCT merely because bottom bars exist.** The tie must actually enter and be developed within the extended nodal zone, and other tension forces can change the classification.  
    Fix: Determine node type from force directions and verify that each assumed tie is physically anchored within that node.

12. **The plan conflates two distinct distributed-reinforcement provisions.** Deep-beam minimum web reinforcement under §9.9 and STM crack-control reinforcement crossing bottle-shaped struts under §23.5 are not interchangeable checks.  
    Fix: Implement and report both provisions separately, including the angle-dependent reinforcement crossing each strut.

13. **The conditional bottle-strut factor is underspecified.** Merely having “web steel” does not qualify for the favorable `βs`; its amount, orientation, spacing, and crossing angle must satisfy the applicable STM provision.  
    Fix: Compute qualification per individual strut from the entered horizontal and vertical reinforcement geometry.

14. **The global shear-cap implementation is dimensionally ambiguous.** `φ10√f'c·bw·d` is an imperial-unit expression with force-unit conversion requirements and depends on the correct effective depth and applicable deep-beam provision.  
    Fix: State the unit system in the equation, convert pounds to kips explicitly, and calculate `d` from reinforcement geometry.

15. **All-live-load loading is not necessarily the governing pattern.** Partial UDL live loading or selected point-live loads can maximize a reaction, local tie segment, cantilever negative force, or anchorage demand.  
    Fix: Enumerate relevant live-load presence/absence patterns or clearly prohibit pattern-sensitive loading with a conservative documented envelope.

16. **Negative reactions and tension struts are not handled.** Eccentric point loads or cantilever loading can produce uplift at one support, invalidating the compression-only direct-strut topology.  
    Fix: Detect any negative support reaction or tension-assigned strut and stop with “no admissible STM” rather than reporting DCRs.

17. **“Support loads bypass the truss” is too broad.** A load nominally over a support can still create local wall spreading, node stresses, eccentricity, or moment if its line of action and bearing footprints do not coincide.  
    Fix: Require load and support bearing widths/centroids and bypass global STM forces only when their resultants are demonstrably coincident.

18. **The support-bearing demand is ambiguous when a coincident top load exists.** The wall-to-pier interface carries the structural reaction, while the local top node also receives the applied load; careless superposition can double-count or omit it.  
    Fix: Draw free-body diagrams for the wall, top bearing, and pier interface and calculate each interface force independently.

19. **Bearing enhancement and confinement assumptions are absent.** Nodal strength and pier bearing are different limit states and may have different effective areas and confinement conditions.  
    Fix: Separate ACI bearing strength from STM nodal strength and expose every area-ratio or confinement assumption.

20. **The cantilever module has no resolved STM topology.** The plan explicitly leaves the topology as an open question while promising a negative-moment tie, anchorage, and “tie flip”; that is a material design gap.  
    Fix: Remove Case C from initial scope or provide a fully equilibrated, validated backspan-plus-overhang topology before implementation.

21. **Cantilever free-end anchorage is described backwards or at least incompletely.** A top tie force cannot simply be developed “at the free end” without a physical end node, load plate, hook/head geometry, and sufficient extension beyond the critical section.  
    Fix: Define the free-end node and bar termination geometry and reject configurations that cannot physically fit the required anchorage.

22. **Cantilever and backspan interaction is omitted.** Overhang loading changes both support reactions and backspan chord forces; it is not an isolated negative-moment add-on.  
    Fix: Solve one combined global free body and one compatible STM for the complete wall segment.

23. **Anchorage is not reducible to three selectable length formulas.** Hooked, headed, and straight development each have applicability limits involving bar size, concrete strength, coating, cover, spacing, casting position, head geometry, and transverse reinforcement.  
    Fix: Collect every required ACI modifier and applicability condition or mark unsupported configurations as outside scope.

24. **The `ψr 1.0/1.6` “confinement toggle” is dangerously opaque.** Users can select favorable confinement without proving the required transverse reinforcement and geometry.  
    Fix: Derive the modifier from explicit tie spacing, bar arrangement, cover, and confinement inputs rather than a yes/no toggle.

25. **The critical anchorage section is not universally the inner bearing face.** ACI STM anchorage is tied to where the tie force must be transferred into the extended nodal zone, which depends on node geometry and bar trajectory.  
    Fix: Locate the critical section from the constructed extended nodal zone and show it graphically.

26. **Available embedment is oversimplified.** Pier width plus grade-beam extension does not automatically equal usable development length because cover, bend radius, head clearance, bar termination, construction joints, and concrete boundaries reduce it.  
    Fix: Calculate usable bar centerline length from explicit geometry and all ACI fit/cover constraints.

27. **The plan does not address anchorage at interior or concentrated-load nodes.** Checking only each end misses any top tie, hanger reinforcement, or force transfer required at internal nodes.  
    Fix: Check development and force transfer for every tension tie and node in the solved topology.

28. **No check is proposed for load introduction or hanger reinforcement.** Loads applied through the top of a deep beam may require local bearing, bursting, and suspension reinforcement depending on how they enter the STM.  
    Fix: Add load-plate dimensions and applicable local-node/hanger checks, or explicitly limit loads to direct top bearing with validated node geometry.

29. **The plan permits impossible point-load locations.** It does not reject loads outside the wall, inside bearing zones, coincident loads, loads at support centerlines, or positions that collapse a strut to zero length.  
    Fix: Define mutually consistent coordinate bounds and reject degenerate or overlapping nodes.

30. **Basic invalid-input handling is unspecified.** Zero/negative dimensions, reinforcement area, strength, bearing width, spacing, cover, or nonfinite values can create divide-by-zero, `NaN`, or false passes.  
    Fix: Define a centralized validation layer that suppresses all engineering results until every prerequisite is valid.

31. **Geometry-fit failures are not checks.** Bars, hooks, heads, nodes, and struts may not fit within the entered wall, beam, pier, cover, and spacing dimensions even if calculated lengths pass.  
    Fix: Add explicit detailing-fit checks and make graphic collisions engineering failures rather than merely drawing artifacts.

32. **The scope silently fixes normalweight concrete while formulas still imply `λ`.** A note that `λ=1.0` is inadequate if users can enter concrete types or assume applicability to lightweight concrete.  
    Fix: Label the calculator “normalweight concrete only” at input and result level and prevent unsupported material selection.

33. **The registry entry as described violates the repo schema.** `CalcMeta` also requires `label`, `subtitle`, `htmlFile`, `category`, and `icon`; the plan lists only slug/material/calcType/spec/status.  
    Fix: Specify a complete `CalcMeta` object and confirm the chosen icon exists in `CalcIcon.tsx`.

34. **The proposed spec string contains ambiguous duplication.** “ACI 318-19 Ch. 23 / §9.9” is acceptable display text, but calculations must distinguish which provision governs each check rather than presenting the chapters as interchangeable.  
    Fix: Map every result to one precise section and state when both deep-beam and STM provisions independently apply.

35. **The drawing library feasibility is not established by naming primitives.** The shared library may expose the primitives, but stepped diagrams, concrete nodes, hooks, clipping, responsive sizing, and invalid geometry still require a tested layout strategy.  
    Fix: Build a minimal SVG feasibility spike covering extreme aspect ratios and all anchorage glyphs before committing the calculation UI.

36. **Redrawing on every input event can display plausible graphics for invalid intermediate states.** The sample library consumers use fallback values, which would be hazardous here because a blank or invalid input could silently render defaults.  
    Fix: Make drawings consume only validated state and visibly mark or clear the SVG when validation fails.

37. **Inline local SVG helpers risk duplicating drawing-library behavior and styling.** That creates inconsistent scaling, bounding-box handling, dark-mode behavior, and future maintenance.  
    Fix: Add narrowly reusable primitives to `are-draw.js` when generally useful, otherwise isolate documented calculator-specific overlays behind one adapter.

38. **The verification gate is not reproducible.** “A subagent recomputes blind” provides no persistent test artifact, tolerances per quantity, or regression protection.  
    Fix: Add deterministic pure-function tests with stored inputs, expected reactions/member forces/capacities, and explicit tolerances.

39. **`next build` and ESLint will not validate JavaScript embedded in a public HTML file.** Syntax errors, missing DOM IDs, and runtime `NaN`s can ship while the Next.js build passes.  
    Fix: Add a browser smoke test that loads the static page, changes inputs, checks console errors, and asserts rendered results.

40. **Case B verification is too weak.** Satisfying global `ΣV` and `ΣM` does not prove joint equilibrium, correct tie-force segments, node classifications, or load-pattern envelopes.  
    Fix: Assert equilibrium at every truss node and compare member forces against at least two independently solved asymmetric examples.

41. **Case C’s proposed “tie flip” test is not a sufficient benchmark.** A sign change can occur even when magnitudes, reactions, topology, or anchorage forces are wrong.  
    Fix: Use a published or independently derived complete cantilever/backspan example with reactions and every member force checked.

42. **The default benchmark is circular.** It is explicitly required to match an originating hand calculation that uses the same assumed `jd=0.7h`, so agreement does not validate the model.  
    Fix: Validate against at least one authoritative worked STM example and reserve the hand calculation as a regression case only.

43. **No sensitivity or boundary testing is planned.** Near 25°, `ln/h=4`, zero live load, load at a support face, very narrow bearings, and anchorage equality are precisely where logic and rounding failures occur.  
    Fix: Add boundary tests on both sides of every applicability threshold and DCR transition.

44. **No observability exists for governing combinations and contributions.** A single envelope result can hide which load combination, live-load pattern, strut, node face, or anchorage end governs.  
    Fix: Report stable IDs, governing combination/pattern, force contributions, raw capacity terms, and excluded/invalid cases for every DCR.

45. **Rounding can create false passes.** The plan gives display tolerances but does not require comparisons using unrounded values or warn at near-unity results.  
    Fix: Compute with full precision, round only for display, and flag a configurable near-limit band.

46. **The implementation status should not initially be `ready`.** The engineering model, cantilever topology, anchorage rules, and test strategy remain unresolved.  
    Fix: Register it as `wip` until technical review and automated verification are complete.

VERDICT: REVISE
### Claude's response (Round 1)
Accepted (plan rewritten accordingly): #1 full default load table (18.2 klf = 1.2·(5,525+2,100 wall+600 GB)+1.6·5,205 — decomposition published); #2/#4 explicit joint-equilibrium solve, ΣR·cotθ demoted to internal cross-check; #3 N=10 UDL discretization w/ documented tolerance (midspan T exact under centroid lumping); #5 chord centroids computed (a from stress block, iterated jd); #6 25° reframed as one admissibility check among several; #7 D-region/bearing-face geometry checks added; #8 Acs constructed from node geometry per strut; #9 all node faces checked from extended nodal zones; #10/#11 node class assigned from solved forces; #12 §9.9.3.1 and §23.5 reported separately; #13 βs qualification computed per strut from EF steel; #14 units stated, d computed; #16 negative-reaction/tension-strut guards stop the engine; #17/#18 bearing-coincidence test + explicit FBDs; #19 §22.8 bearing separated from node strength; #21 free-end node geometry + fit rejection; #22 combined global FBD for Case C; #23 full Ch. 25 modifier/applicability sets, unsupported configs rejected; #24 ψr computed from entered tie config (toggle removed); #25 critical section from computed extended nodal zone (inner face shown as comparison); #26 usable embedment from explicit geometry; #27 interior-node ΔT development check; #28 scope-limited to direct top bearing (stated at input+results); #29/#30 centralized validation layer, no results/drawing on invalid input; #31 detailing-fit failures are check failures; #32 normalweight-only locked at input; #33 complete CalcMeta specified; #34 one governing section per check; #35 SVG spike is first task; #36 drawing consumes validated state only, blanks otherwise; #38 deterministic fixtures in fixtures/; #39 scripted browser smoke test; #40 per-node equilibrium assertions + two asymmetric fixtures; #41 full independent cantilever fixture; #42 independent UT/FHWA worked example as validator, hand calc demoted to regression; #43 boundary tests both sides of every threshold; #44 governing combo/pattern + contribution reporting per DCR; #45 full-precision compute, 0.95–1.05 near-limit flag; #46 status wip until final gate.

Rejected/modified with reasons: #15 — full-LL governs Cases A/B by monotonicity (member forces are nonneg. linear combinations of loads on a simple span); proof stated in-calc; pattern enumeration implemented for Case C only. #20 — "remove Case C" branch rejected (explicit user requirement); accepted the underlying demand instead: topology fully specified in plan §3 with its own complete verification fixture. #37 — "extend are-draw.js" branch rejected (regression risk to 40+ existing calcs); chose the isolation branch: documented calculator-local overlay module.

## Round 2 — Codex
Most repo-integration and verification findings were addressed, but the core structural model still has material problems.

1. **The proposed multi-fan truss is generally statically indeterminate, so joint equilibrium alone cannot solve it.** With multiple load nodes connected to both supports plus top-chord members, there are more member-force unknowns than independent equilibrium equations.  
   Fix: Define a statically determinate topology or state and validate the additional compatibility/stiffness assumptions used to resolve redundants.

2. **“One pair of inclined struts per load node” produces overlapping/crossing fans without defining interaction.** Crossings may be harmless mathematically, but overlapping bottle-shaped struts compete for the same wall thickness and reinforcement and cannot each claim independent effective widths.  
   Fix: Use a non-overlapping truss topology or explicitly limit combined strut widths/stresses and crack-control reinforcement where strut fields overlap.

3. **The top-chord stress-block calculation is not compatible with the proposed STM as written.** A Whitney flexural block at maximum moment does not uniquely establish the coordinates or widths of every top-chord member and load node.  
   Fix: Construct nodal zones and chord widths from the solved STM forces and bearing geometry, then iterate the complete geometry—not only a global `a ↔ jd`.

4. **The geometry iteration is circular and potentially topology-changing.** Member forces depend on strut angles, angles depend on `a`, and `a` depends on compression force; different load combinations can therefore have different geometry and even different admissibility.  
   Fix: Define a converged geometry solution separately for every combination/pattern and prove uniqueness or reject nonunique/nonconvergent solutions.

5. **The stated §23.5 threshold appears wrong.** The plan uses `Σ(Asi/(b·si))sin²αi ≥ 0.0025`; ACI 318-19 STM crack-control reinforcement uses 0.003, while 0.0025 belongs to the separate deep-beam distributed-reinforcement requirements.  
   Fix: Correct §23.5 to the edition-specific 0.003 requirement and keep the §9.9.3.1 ratios separate.

6. **The strut-area equation is insufficiently defined and likely misapplied.** `Acs = (lb sinθ + wt_node cosθ) × min(wall t, strut available thickness)` does not define the symbols, which node controls, truncation by adjacent struts, or why two thickness quantities are minimized.  
   Fix: Define the perpendicular strut width geometrically at both ends, take the governing width, multiply once by wall thickness, and enforce non-overlap.

7. **Extended nodal-zone geometry remains asserted rather than specified.** Saying every face will be checked does not explain how node polygons are constructed when multiple struts and ties meet or how hydrostatic compatibility is achieved.  
   Fix: Provide an explicit node-construction algorithm, including face orientations, dimensions, equilibrium, overlap resolution, and failure when the node cannot fit.

8. **The direct-routed support-load node is still conceptually ambiguous.** A load routed “directly to the pier” cannot simultaneously receive an STM node check unless the local load-to-support stress field and its interfaces are defined.  
   Fix: Specify separate top-bearing, wall-block, and wall-to-pier interface checks and show exactly which force acts on each.

9. **The Case A/B monotonicity claim is not established for this model.** An indeterminate truss can have opposing member-force contributions, and the iterated geometry makes responses nonlinear even if external statics are linear.  
   Fix: Either prove monotonicity for the final determinate fixed-geometry topology or enumerate live-load patterns.

10. **The cantilever “transition point” is not a defined truss node.** A tie cannot continuously decay until “compression overtakes it” in a discrete STM without explicit nodes and equilibrium at the transition.  
    Fix: Define discrete backspan nodes and members, solve their forces, and locate tie termination only at a real node.

11. **Case C omits bar-cutoff development beyond the theoretical zero-force point.** Even if the top tie force becomes zero in the backspan model, reinforcement cannot terminate exactly there.  
    Fix: Check extension/development beyond the theoretical cutoff using the applicable Chapter 25 provisions.

12. **Case C patterning is incomplete when point live loads are independently optional.** “Overhang only / backspan only / both” does not enumerate independently present point-load live components if multiple point loads are permitted.  
    Fix: Enumerate relevant subsets of independently variable live loads or explicitly group them into inseparable load sources.

13. **The free-end available straight development length is described incorrectly.** `overhang length − cover − bend fit` is not generally the length available beyond the outermost load node; it depends on that node’s position relative to the free end.  
    Fix: Measure usable development from the computed critical node face to the actual bar termination along the bar centerline.

14. **The input-validation language contradicts itself.** It says loads inside bearing widths are “rejected” and also “re-routed.”  
    Fix: Classify them deterministically as routed loads and reject only ambiguous boundary/overlap cases.

15. **The bearing-edge case lacks a tolerance rule.** Floating-point coordinates exactly at a bearing face can alternate between routed and truss behavior, creating a discontinuous result.  
    Fix: Define a geometric tolerance and a conservative classification rule for loads touching bearing boundaries.

16. **Support and wall coordinate definitions remain incomplete.** The plan does not fully distinguish wall length, support center spacing, clear span, bearing widths, grade-beam extensions, and overhang coordinates.  
    Fix: Add one coordinate-system specification with inequalities covering every geometry input.

17. **Self-weight treatment and the original benchmark mismatch are still unresolved.** The revised plan no longer supplies the complete wall thickness, loaded length, grade-beam weight, and factored decomposition needed to reproduce the stated session result.  
    Fix: Include a full default-input/load table and reconcile the expected `wu`, reaction, and tie force before implementation.

18. **`φ` values are not explicitly specified per limit state.** The plan shows equations containing `φ` but does not state the ACI 318-19 values or distinguish STM, bearing, and shear factors.  
    Fix: List each resistance factor, its citation, and its implementation constant in the plan and fixtures.

19. **The Grade 80 option needs more than a generic “§23.7 cap.”** Development equations, hook/head applicability, and tie-strength limits may not all permit identical treatment at 80 ksi.  
    Fix: State every Grade 80 restriction and reject anchorage types or configurations not permitted by the cited provisions.

20. **“Bottom tie continuous through all interior nodes” is unclear because the defined interior top-load nodes are not on the bottom chord.** The plan appears to invent bottom interior nodes not included in the topology description.  
    Fix: Enumerate every node and member explicitly and identify where each `ΔT` transfer check occurs.

21. **Checking `ΔT` between adjacent nodes using only `ℓd` is not generally sufficient.** A change in tie force is transferred through bond over a length, but the applicable required development depends on bar force, available length, bar continuity, and node force transfer.  
    Fix: Calculate required force development from actual stress change and available transfer length using the applicable development provisions.

22. **The global shear-cap `d` definition is still suspect.** “Computed tension centroid” is not itself `d`; effective depth is measured from the extreme compression fiber to the centroid of longitudinal tension reinforcement.  
    Fix: Define `d` explicitly from the appropriate compression face for each shear direction/load case.

23. **The test architecture is not actually executable as described.** A pure engine embedded inside an HTML `<script>` module is not automatically importable by a headless Node test, and no test runner or command is specified.  
    Fix: Put the engine in a standalone importable JS module, add a committed test runner, and expose a reproducible package command.

24. **The browser smoke test is a manual one-off, not regression protection.** “Scripted via the preview browser” does not guarantee a committed repeatable test.  
    Fix: Commit an automated browser test or at minimum a reusable script with assertions and documented execution command.

25. **Matching an authoritative example with a different topology may be impossible and cannot be deferred as a mapping exercise.** Agreement of reactions alone would not validate member or node capacities.  
    Fix: Select the authoritative benchmark and demonstrate topology compatibility during planning, before using it as the implementation gate.

26. **The feasibility spike still omits critical SVG failure cases.** Long force labels, many UDL nodes, overlapping nodes/struts, mobile width, print layout, and invalid-to-valid state transitions are likely failure modes.  
    Fix: Add these cases and objective clipping/overlap checks to the spike acceptance criteria.

27. **Moving directly from `wip` to `ready` “at final deploy” reverses the useful gate.** Readiness should be established before deployment, not as part of it.  
    Fix: Promote to `ready` only after engineering review, fixture tests, browser tests, and user sign-off pass locally.

VERDICT: REVISE
### Claude's response (Round 2)
Accepted: #1 model rebuilt as superposition of determinate single-load sub-trusses (lower-bound admissible; FHWA load-path method) — no indeterminate solve; #2 fan-resultant check at support nodal faces, mid-panel crossings covered by §23.5 + lower-bound argument (documented); #3/#7 explicit node-construction algorithm (plan §4) with fit-failure = check failure; #4 geometry converged per combination, non-convergence = error state; #5 real catch — 318-14/318-19 confusion; plan now states Table 23.5.1 (2019) 0.0025 orthogonal each-way as the βs qualifier, with build-time verification against the licensed code text; #6 Acs defined per node end with symbols, governing end checked; #8 routed-load FBD chain (top bearing → wall block → pier interface) each checked once; #10 Case C tie terminates at a defined discrete node; #11 cutoff development beyond theoretical termination per Ch. 25 + d/12db; #12 exhaustive ≤32-pattern enumeration for Case C; #13 free-end development measured from critical node face along bar centerline; #14/#15 deterministic routing rule with explicit tolerance, conservative default classification; #16 single coordinate-system spec with inequalities (plan §1); #17 full default/benchmark table published (18.198 klf decomposition); #18 φ table stated (0.75 STM, 0.65 bearing, 0.75 shear); #19 Grade 80 cut from v1; #20/#21 topology enumerated, ΔT transfer check defined as ℓd·(Δfs/fy) vs available length; #22 d = h − ȳ_t from top-of-wall compression fiber, stated; #23 engine moved to standalone UMD module + committed Node test runner + npm script; #25 benchmark selection promoted to first implementation task, gating engine coding, with hand-derived fallback logged; #26 spike acceptance criteria extended (labels, 13-node UDL, mobile, print, transitions, no-clip assertions); #27 status "ready" set after local verification + sign-off, before deploy.
Partial: #9 monotonicity re-proven for the determinate fixed-geometry model incl. the a↔jd coupling direction (removing load shrinks a, grows jd, lowers T) — enumeration still not needed for A/B; adopted exhaustive enumeration for C where the claim genuinely fails. #24 no new npm deps in a dep-free repo: automated browser test only if a browser-test dep already exists; else committed repeatable smoke script/checklist + session-driven browser execution — logged tradeoff.

## Round 3 — Codex
Rev 2 fixes most software-plan issues and many detailing/verification gaps. The remaining blockers are concentrated in the structural model itself.

## Material blockers

1. **The superposed triangular sub-trusses do not produce the claimed stepped tie-force diagram.** Each single-load triangle has a bottom tie spanning between both supports with constant force, so superposition produces one constant bottom-tie force over the span.  
   Fix: Either accept and document a constant conservative tie force or define a different determinate topology that actually produces `T(x)` steps.

2. **The proposed UDL model does not reproduce the claimed midspan-exact result.** For constant lever arm `z`, superposed full-span triangular ties give  
   `T = Σ[Pj xj(L−xj)/(Lz)] → wL²/(6z)`, whereas the beam midspan value is `wL²/(8z)`; the model is about 33% higher for a continuous UDL.  
   Fix: Reconcile the selected fan topology with the benchmark analytically and remove the “midspan exact” claim unless the topology is changed.

3. **The default target of approximately 99 k is inconsistent with the new model.** The prior 99 k result corresponds roughly to `Mmax/z`; the Rev 2 superposition model will instead approach `wL²/(6z)`, approximately 132 k using the stated load, span, and lever arm.  
   Fix: Calculate the Rev 2 default result by hand before coding and either revise the benchmark or revise the STM topology.

4. **The plan refers to a top chord that does not exist in the stated single-load triangles.** For a downward load connected by two compression struts to the supports, the horizontal strut components balance at the load node; the third member is the bottom tie, not a top chord. Consequently, “maximum top-chord force,” top-chord segments, and top-chord force differences are undefined.  
   Fix: Draw and enumerate the exact members in one sub-truss, then remove top-chord calculations or add a topology that genuinely contains a top chord.

5. **The `a ↔ jd` iteration is therefore based on an undefined compression member.** A Whitney block calculated from `Cmax` cannot locate top nodes when the model’s compression is carried by diagonal struts rather than a continuous top chord.  
   Fix: Derive node heights and lever arm from a compatible nodal-zone construction for the actual triangle, not an unrelated flexural stress block.

6. **Checking each crossing strut independently does not establish a valid superposed concrete stress field.** Lower-bound superposition guarantees equilibrium, but the stresses also superimpose; two individually acceptable crossing compression fields can exceed concrete capacity where they overlap. Section 23.5 reinforcement controls splitting, not combined concrete crushing.  
   Fix: Calculate the combined stress tensor/principal compression in overlap regions or use a non-overlapping fan idealization with a validated effective strut boundary.

7. **The statement that “node-interface checks govern” mid-panel crossings is unsupported.** Support-node resultants resolve congestion at supports but say nothing about peak compression where multiple interior strut fields overlap.  
   Fix: Add an interior combined-compression check or cite and implement a validated fan-region capacity model.

8. **Case C still lacks a complete equilibrated topology.** A top tie cannot simply terminate where backspan compression becomes numerically larger; its horizontal force must be transferred through explicit members at the termination node.  
   Fix: Show the termination node’s complete member set and joint-equilibrium equations, including the diagonal or other member that transfers the tie force.

9. **“Backspan sub-trusses with modified reactions” is not enough to equilibrate the overhang field.** An overhang strut into the left support and a top tie into the backspan introduce horizontal forces that must be resolved through the backspan and ultimately into the supports.  
   Fix: Provide one complete cantilever/backspan truss diagram and a hand solution before treating Case C as implementation-ready.

10. **The default geometry violates the plan’s own bearing-footprint constraints.** A 30-inch bearing centered at `xL = 0` extends 15 inches beyond a wall beginning at `x = 0`; likewise `xR = 26 ft` extends beyond the right wall end.  
    Fix: Set default support centers to 1.25 ft and 24.75 ft, redefine `xL/xR` as bearing faces, or explicitly model wall/support overhang beyond the stated wall endpoints.

11. **Correcting the support coordinates changes the benchmark statics.** With support centers moved inward, the support span is no longer 26 ft, while UDL exists over wall overhangs; reactions and STM routing must be recomputed.  
    Fix: Publish one geometrically valid free-body diagram and recompute the full benchmark from its actual loaded lengths and support coordinates.

12. **The coordinate constraint for `xL = 0` is self-contradictory.** “Edge distance allowed only ≥ half bearing width” cannot hold when the support centerline is at the wall edge.  
    Fix: Require `xL ≥ lbL/2` and `xR ≤ Lw − lbR/2`, unless wall length is intentionally defined between support centerlines instead.

13. **The load-routing tolerance can misroute eccentric loads.** A centroid within up to 1% of bearing width is treated as coincident even though a finite eccentricity creates a local couple; requiring the load footprint to fit does not eliminate that eccentricity.  
    Fix: Either include eccentric local bearing effects or route directly only when centroids coincide within a small numerical tolerance unrelated to member size.

14. **The D-region applicability row incorrectly presents the tests as cumulative.** ACI’s applicability language should not be reduced to `ln/h ≤ 4 AND every concentrated load within 2h` without confirming that this is the intended edition-specific condition.  
    Fix: Quote/paraphrase the exact logical relationship from the licensed ACI 318-19 text and implement that Boolean logic directly.

15. **The fallback authority validation is too weak for a safety-critical model.** If no published topology matches, a hand-derived fixture reviewed by the project owner verifies arithmetic but not the modeling assumptions that are currently disputed.  
    Fix: Require a published compatible model or an independent structural-engineering review before releasing the calculator as `ready`.

## Implementation-detail polish

These are not plan blockers if handled during implementation:

- Define whether UDL acts over the whole wall or only between support centerlines, including Case C overhangs.
- Replace the absolute `1e-9` equilibrium tolerance with a scale-aware relative tolerance; large kip forces and floating-point summation may make `1e-9` unnecessarily brittle.
- Clarify whether geometric non-fit is an invalid model rather than an ordinary capacity DCR failure.
- Give the selected registry icon explicitly once the spike begins.
- Prefer an automated browser test eventually; the committed manual smoke checklist is acceptable for v1 if execution is logged.
- Verify the ACI 318-19 §23.5 wording before implementing `βs`; the plan appropriately identifies this as an edition-sensitive item.
- Clarify that the near-bearing tolerance is expressed in one consistent unit after conversion.

VERDICT: REVISE
### Claude's response (Round 3)
Accepted — all 15 material blockers. The big one: #1–#5 were a genuine modeling error in Rev 2 (superposed load-path triangles give constant T = ΣP·x(L−x)/(Lz) → wL²/6z for UDL, 33% over the wL²/8z benchmark, with no top chord for the stress block to locate). Rev 3 replaces the model with a **polygonal funicular arch + constant tie** (vertices proportional to M(x), H = M_max/z_max): determinate, no crossing fields (#6–#7 eliminated by construction), midspan-exact, crown depth a defined by the arch thrust itself, constant tie = full anchorage at supports (the correct deep-beam conservatism). #8–#9: Case C topology completed — explicit termination node with diagonal-to-support member and joint equilibrium, shared support node checked via face resultants. #10–#12: defaults made geometrically valid (L_w 28.5 ft, supports at 1.25/27.25, x_L ≥ lb/2 constraint), benchmark FBD recomputed and published (M = 1,524 k-ft, T ≈ 98 k); original hand calc kept as separate regression fixture with its own geometry. #13: routing only within 0.25" of the support centerline; eccentric near-support loads go through the truss. #14: exact §9.9.1.1 boolean implemented from licensed text, clause-level reporting. #15: fallback fixture now requires documented independent second-licensed-engineer review before "ready".
Polish items all folded in: UDL extent defined (full wall length); relative equilibrium tolerance (1e-9 × ΣP); "model does not fit" separated from capacity DCR failure; icon selected at spike start; smoke executions logged in the committed checklist; §23.5 build-time text verification retained; single internal unit system (inches) for tolerance consistency.

## Round 4 — Codex
Rev 3 materially improves the simple-span concept: a funicular polygon with constant horizontal thrust is coherent for loads located between supports. However, the default overhang loading and Case C topology remain incompatible with that model.

## Material blockers

1. **The default case is not a pure funicular tied arch because its UDL extends beyond both supports.** The stated overhangs create negative support moments `−wc²/2`, while §2 requires the compression polygon to pass through support nodes at `M=0`. The benchmark itself subtracts the overhang moment, confirming this incompatibility.  
   Fix: For Cases A/B, restrict truss UDL to between support centerlines and route outboard wall weight separately, or model both outboard portions using explicit cantilever top-tie systems.

2. **`yarch = zmax·M/Mmax` cannot both use the actual overhang-beam moment diagram and pass through the supports at zero ordinate.** Actual moment at each support is negative when the wall continues beyond it. Arbitrarily shifting the diagram would change the physical horizontal-thrust relationship and require additional end moments.  
   Fix: Require `M=0` at both arch springings or explicitly include the members that equilibrate nonzero support moments.

3. **The default benchmark therefore does not validate the proposed arch topology.** `Mmid = wLs²/8 − wc²/2` belongs to a beam with loaded overhangs, not the zero-moment springing arch described in §2.  
   Fix: Recompute the default with no truss overhang load, or make the default a combined arch-plus-two-cantilevers model and verify all resulting members.

4. **The interior arch-band area/stress equations are internally inconsistent.** With segment force `F=H/cosα`, constant stress requires normal strut width proportional to `1/cosα`. The plan instead simplifies  
   `ak = a·(F/H)·cosα = a`, then checks stress as `H/(ak tw)`, omitting the segment force `F`.  
   Fix: Define `Acs` normal to each segment and check `F/Acs`; if constant stress is intended, derive `ak = a/cosα` or the correct geometry-specific equivalent.

5. **The crown-depth iteration does not establish that the widening compression band fits near the springings.** Even if crown depth `a` is adequate for horizontal thrust, inclined segments carry `H/cosα` and may require larger normal widths.  
   Fix: Construct both boundaries of the complete compression band and reject it if any segment or node exceeds the available wall region.

6. **The arch-vertex node construction is not sufficiently defined to ensure compatible faces.** “Width from vertical-member bearing width” and `ak` do not specify a closed nodal polygon whose three face forces are equilibrated at permissible stresses.  
   Fix: Give an explicit three-face CCC-node construction using the vertical-member force and both adjacent segment forces, then check every face independently.

7. **UDL vertical-member widths are undefined.** A lumped UDL resultant does not have a user-entered bearing width; assigning an arbitrary narrow width could create fictitious node failures, while assigning too much width could overstate capacity.  
   Fix: Give each UDL resultant the tributary segment width, clipped or merged where it interacts with point-load bearing zones.

8. **The Case C overhang topology does not equilibrate multiple overhang load nodes as described.** Each inclined overhang strut has a horizontal component, so the top tie must have discrete segments whose forces accumulate between load nodes; one undifferentiated tie from the outermost node is insufficient.  
   Fix: Enumerate a top-tie segment between every adjacent overhang node and solve the force change at each joint.

9. **The termination node is not in vertical equilibrium.** The plan balances the horizontal top-tie force with the diagonal’s horizontal component, but the diagonal also applies a vertical component at the termination node. No member or applied load is defined to balance that component.  
   Fix: Add and solve the required vertical member/load at the termination node or replace the termination triangle with a fully equilibrated truss panel.

10. **Choosing the termination node merely from the 25° guard does not solve its equilibrium.** The diagonal angle is controlled by both horizontal tie force and the available vertical balancing force, not by geometry alone.  
    Fix: Select the node from simultaneous horizontal and vertical joint equilibrium, then apply the angle check afterward.

11. **Case C’s backspan arch cannot simply use “reactions from the combined free body.”** A funicular arch force polygon is tied to the actual loads assigned to it; injecting support effects from a separate overhang system without representing their forces at the shared node can violate the backspan arch’s force polygon.  
    Fix: Draw one complete external and internal free body and derive the backspan arch boundary forces from the explicitly connected cantilever members.

12. **Collapsing all Case C compression members into one support-node resultant can hide incompatible node faces.** A backspan springing strut, overhang struts, and termination diagonal arrive from different directions and generally require separate nodal faces; their vector resultant alone does not prove local nodal-zone admissibility.  
    Fix: Construct a multi-face support nodal zone and check each compression face, or justify a physical fan region that legitimately combines them before the node.

13. **The 25° logic is incomplete for Case C.** The termination diagonal and overhang struts adjoin the top tie and therefore need the applicable strut-to-tie angle check, not just a placement guard at the termination node.  
    Fix: Check the angle between every compression strut and every adjoining tension tie.

14. **The claimed monotonicity of every arch force is too strong.** Increasing one asymmetric load can move `Mmax`, alter `a`, and steepen some polygon segments while flattening others; individual segment force and nodal stress monotonicity does not follow solely from increasing `H`.  
    Fix: Enumerate Cases A/B point-live-load patterns too, or prove monotonicity separately for every reported response rather than only for tie force.

15. **The published springing-angle benchmark appears inconsistent with its own forces.** Using approximately `R=259.3 k` and `H=98 k` gives `atan(R/H) ≈ 69.3°`, not 66–68°.  
    Fix: Recalculate the benchmark after resolving the overhang model and publish values derived from the same final topology.

## Implementation-detail polish

These do not independently block implementation once the structural model is corrected:

- State whether `a` is a vertical band depth, normal strut width, or nodal-face dimension; those are not interchangeable.
- Clarify how point-load nodes and UDL tributary nodes are merged when their widths overlap.
- Use a slightly less brittle equilibrium tolerance, such as a relative tolerance near `10⁻8` plus a small absolute floor.
- Add tests for movement of the maximum-moment vertex between adjacent discretization points.
- Include asymmetric support widths and asymmetric wall overhangs in fixtures.
- Test cases where the compression band fits at the crown but fails near a springing.
- Label geometric model failures separately from reinforcement-detailing failures; both currently use “model does not fit.”
- The manual browser-smoke compromise remains acceptable for v1 if its execution record is committed.
- Build-time verification of edition-sensitive ACI text is acceptable, but release must remain blocked until completed.

VERDICT: REVISE
### Claude's response (Round 4)
Accepted — all 15 blockers. #1–#3: UDL extent rule added (§1): only between-centerline UDL enters the truss; outboard strips (bounded ≤ max(lb, h_w/4)) are routed loads into the adjacent bearing; larger outboard length forces Case C. Springings sit at M = 0 exactly; benchmark recomputed as a consistent set (R_truss 236.6 k / R_bearing 259.3 k / M 1,538 k-ft / T ≈ 99 k / θ = atan(236.6/99) ≈ 67°) — also fixes #15. #4–#5: arch band defined — a = vertical band depth, normal width a·cosα, σ_k = H/(a·t_w·cos²α_k) checked per segment, band-boundary fit check with "geometry infeasible" state. #6: explicit three-face CCC vertex construction, each face checked independently. #7: UDL vertical members get tributary width L_s/N, merged with point-load bearings on overlap. #8–#11: Case C rebuilt as one connected determinate truss solved by method of joints — segmented top tie with per-joint force accumulation, anchor vertex N_a is a backspan polygon vertex where the thrust steps (H_left = H_right − T_top) and the polygon kinks for vertical closure; bottom tie = actual springing thrusts; determinacy verified programmatically; member-sign flips → "no admissible STM". #12: overhang-side support nodal zone subdivided proportional to vertical components, per-sub-face checks (resultant-only check dropped for Case C). #13: strut-to-tie angle checks for every adjoining pair. #14: monotonicity shortcut abandoned — exhaustive pattern enumeration for ALL cases (≤16 A/B, ≤32 C). Polish: all folded in (a defined as vertical depth; merge rule; 1e-8 relative + absolute-floor tolerance; M_max-vertex-movement and springing-fit fixtures; asymmetric fixtures; "geometry infeasible" vs "detailing does not fit" labels; smoke log committed; ACI text verification blocks release).

## Round 5 — Codex (final round)
Rev 4 makes Cases A/B substantially more coherent, but two structural blockers remain: the compression-band sizing guarantees failure, and the Case C bottom-tie forces violate member equilibrium.

## Material blockers

1. **The crown-depth iteration effectively guarantees that every arch fails its strength check.** The plan sets  
   `H = 0.85 f'c tw a`, so crown stress is `H/(a tw)=0.85f'c`; capacity is only `φ·0.85·βs·f'c`, with `φ=0.75` and `βs≤0.75`. The resulting crown DCR is at least `1/(0.75·0.75)=1.78`, independent of loads or geometry.  
   Fix: Size `a` using the applicable design stress `φ·0.85·βs·f'c`, or decouple arch-axis location from compression-band width and calculate the required band width separately.

2. **Using `βs` in the geometry iteration requires explicit per-combination qualification.** The required band width changes depending on whether the entered web reinforcement qualifies for `βs=0.75` or only `0.4`.  
   Fix: Determine `βs` first from validated reinforcement, then iterate geometry using that value and rerun band-fit checks for every combination/pattern.

3. **Case C assigns different axial forces to the two ends of one uninterrupted bottom tie.** A two-node bottom-tie member with no intermediate joint or applied axial force must have constant force, yet the plan assigns `Hleft` at one springing and `Hright` at the other, with `Hright−Hleft=Ttop`.  
   Fix: Either make the bottom-tie force constant and revise the connected truss accordingly, or add a real intermediate node and force-transfer member that explains the tie-force change.

4. **The Case C left-support equilibrium omits the horizontal components of the overhang struts.** The plan says left bottom-tie force equals `Hleft`, but the support node also receives all overhang-strut horizontal components. Those forces must be included in the tie demand.  
   Fix: Solve the complete support joint and derive bottom-tie force from all arriving members rather than equating it to the backspan polygon thrust alone.

5. **The Case C topology is inconsistent between §§3 and 4.** Section 3 replaces the former termination diagonal with an anchor vertex in the backspan polygon, while §4 still says the support node receives an “overhang strut + diagonal” and uses a resultant-face construction that §3 explicitly rejects in favor of subdivided faces.  
   Fix: Rewrite §4 for the Rev 4 topology and use the same member list and subdivided nodal-zone method everywhere.

6. **Section 5 incorrectly states that the tie force is constant for the entire calculator.** That is true for Cases A/B, but the current Case C description explicitly claims different springing thrusts and a tie-force diagram. This affects both strength and anchorage checks.  
   Fix: Separate the Cases A/B constant-tie check from the final, equilibrated Case C tie-member checks.

7. **The outboard-UDL routing limit is not physically justified.** Allowing `c ≤ max(lb,hw/4)` can route a strip several feet beyond the pier as direct bearing merely because the wall is tall; that strip produces cantilever moment and cannot automatically “sit essentially over the pier.”  
   Fix: Permit direct routing only for load tributary area within the support footprint or a documented load-dispersion zone; otherwise require Case C.

8. **Ignoring outboard negative moment may be conservative for the bottom tie but is not conservative for omitted top reinforcement and local nodes.** A scope decision cannot discard a demand merely because another limit state improves.  
   Fix: Route only genuinely coincident bearing load or check the outboard strip’s negative-moment load path and top reinforcement.

9. **The claimed explicit three-face node geometry still does not prove that the faces form a compatible polygon.** At a kink in a constant-vertical-depth band, the actual intersection face depends on both adjacent slopes; assigning each inclined face `a cosα` independently may not produce a closed, non-overlapping node.  
   Fix: Construct the node from intersections of the actual upper/lower band boundaries and calculate face lengths from that polygon.

10. **A vertical UDL member merged with a point-load member needs force-consistent geometry, not just footprint merging.** Combining footprints without specifying the merged centroid and force can alter the funicular joint location and destroy local equilibrium.  
    Fix: Replace overlapping loads with one resultant at the force-weighted centroid and rebuild the moment polygon, or retain separate adjacent nodes.

## Implementation-detail polish

- Reconcile the `10⁻8` runtime tolerance in §2 with `10⁻9` in §11.
- Remove stale references to a Case C “diagonal” from graphics, key decisions, and node descriptions.
- State whether the arch-band boundaries are clipped at the extended nodal zones or geometrically joined to them.
- Add a regression proving that decreasing `βs` enlarges the required band and can change a fit result.
- Add a Case C assertion that every uninterrupted tie segment has identical end forces.
- Report routed outboard load as an explicit assumption in the final results, not only in input help.
- Clarify that a `1.4D` case has no meaningful live-load pattern enumeration.
- The repo integration, validation architecture, SVG spike, registry plan, observability, and test harness are otherwise implementation-ready.

VERDICT: REVISE
### Claude's response (Round 5)
Accepted — all 10 blockers and all polish items, folded into Rev 5: #1 band sized with design stress f_ce = 0.75·0.85·βs·f'c; strut check recast as required-vs-available width fit DCR (sizing at nominal stress made the check unpassable by construction — the round's best catch); #2 βs resolved from validated reinforcement BEFORE geometry iteration, band-fit re-run per combination/pattern; #3–#4 Case C bottom tie is one two-node member with constant force; solved support joints give T_bot = H_right = H_left + Σ(overhang strut horizontals) — equality asserted at runtime; both anchorages develop full T_bot; #5 §4 rewritten to the Rev 4/5 topology (stale "diagonal"/resultant language scrubbed everywhere; Case C support = subdivided sub-faces per arriving member); #6 constant-tie statement scoped to A/B, Case C tie checks from solved members; #7 routing limited to a documented dispersion zone (wall ≤ h_gb beyond bearing outer face, 45° through the GB); #8 outboard strip negative moment checked against top bars (not discarded); #9 vertex node faces constructed from actual band-boundary intersections; #10 overlapping load footprints replaced by one resultant member at the force-weighted centroid with the moment polygon rebuilt. Polish: tolerance unified (1e-8 relative + 1 lb floor); band-to-nodal-zone junction stated as joined; βs-downgrade fit-flip fixture; tie end-force identity fixture; routed-load assumption echoed in results; 1.4D no-pattern note.

## Resolution — MAX_ROUNDS (5) reached without APPROVED
No unresolved disagreements remain: every round-5 finding was accepted and incorporated. The loop terminates at the cap per protocol; convergence is NOT claimed. Handed to Nick with the options: accept Rev 5 as the locked plan (his sign-off is the actual gate), or extend the review for one more round to seek a formal APPROVED.

## Round 6 — Codex (user-extended round)
Rev 5 closes most prior findings, but the Case C force signs and several nodal-zone definitions remain materially inconsistent.

## Material blockers

1. **The Case C horizontal-force identities have the wrong signs for a left overhang.** At the anchor vertex, equilibrium gives `H_left = H_right + T_top`, not `H_right = H_left + T_top`; at the overhang-side support, the overhang struts reduce—not increase—the bottom-tie force relative to `H_left`.  
   Fix: Establish one sign convention, draw the joint free bodies, and rederive both identities before coding.

2. **The claimed bottom-tie end-force equality follows from the incorrect signs.** With the stated equations, the runtime assertion would validate the plan’s assumed identity rather than physical joint equilibrium.  
   Fix: Derive `T_bot` independently at both support joints from solved signed member forces and assert equality only afterward.

3. **Section 4 still uses the obsolete crown-width face `a·cosα` at every arch vertex.** Rev 5 defines a widening band with segment-specific normal width `w_req,k`; using `a·cosα` ignores that geometry and conflicts with the required-width model.  
   Fix: Construct each segment face using its actual segment-specific band boundary and normal width.

4. **The promised boundary-intersection node construction is not actually specified.** Section 4 still assigns three independent face widths rather than deriving the closed node polygon from intersections of adjacent widened-band boundaries and the top bearing face.  
   Fix: Make the node polygon the geometric intersection of the two actual segment bands and vertical load path, then obtain face lengths from that polygon.

5. **Case C anchor node `N_a` has four forces, but §4 only defines a three-face arch-vertex node.** Its left and right polygon segments, top tie, and vertical load require a distinct CCT/CTT nodal-zone construction and fit check.  
   Fix: Add an explicit four-force `N_a` node algorithm with all compression and tension faces, stresses, anchorage, and polygon-fit criteria.

6. **The Case C support-node procedure subdivides only the bearing face.** Separate arriving struts also require compatible compression faces and tie faces within one non-overlapping nodal zone; dividing bearing pressure alone does not establish node admissibility.  
   Fix: Construct the complete multi-face support node from all arriving members and check every sub-face plus the bottom- and top-tie anchorage faces.

7. **The routed outboard-strip check covers only negative flexure.** A strip extending outside the bearing also creates shear, local D-region forces, and top-bar development demands; checking top-bar moment alone is not a complete load path.  
   Fix: Check cantilever shear/STM, support node, and top-bar development, or permit routing only where the strip lies directly over the bearing footprint.

8. **The 45° dispersion rule is not reconciled with the entered wall and grade-beam geometry.** Limiting extension to `h_gb` does not by itself prove that the entire dispersed footprint lands within the pier bearing, especially with unequal bearing and grade-beam widths.  
   Fix: Calculate the actual 45° projected footprint and require it to fall within the bearing/interface geometry.

## Implementation-detail polish

- Rename the lingering `a↔jd` risk to the actual `a↔zmax` iteration.
- Clarify whether `f_ce` is used only to compute required width or also as the reported capacity; avoid manufacturing DCR = 1.0 by definition when available width exceeds required width.
- Add signed-force fixtures for both left and right overhangs so mirrored cases cannot conceal sign errors.
- Add a Case C test that independently verifies equilibrium at `N_a` and both supports, not merely the bottom-tie identity.
- Clarify how widened adjacent segment bands join without gaps or overlaps away from load nodes.
- Distinguish “model does not fit” from “detailing does not fit” consistently; §5 still labels detailing failures as model failures.
- The software architecture, registry integration, validation, observability, benchmark decomposition, pattern enumeration, and test harness are otherwise sufficiently planned.

VERDICT: REVISE
### Claude's response (Round 6)
Accepted — all 8 blockers, verified by hand before accepting: #1–#2 the sign convention WAS backwards; joint free bodies give H_left = H_right + T_top at N_a and T_bot = H_left − Σ(strut horizontals) at the overhang support; the constant-tie conclusion T_bot = H_right survives, and the runtime check now derives T_bot independently at each joint from solved signed forces and compares (physics check, not assumption echo); #3–#4 vertex nodes constructed as the geometric intersection of the two adjacent widened segment bands (per-segment w_req,k, not crown a·cosα) + vertical load path, faces measured on the closed polygon; #5 N_a gets its own four-force CCT/CTT construction with a tie anchorage face and back-face height from the top-bar centroid; #6 Case C support node is a complete multi-face zone (per-member compression faces + both tie anchorage faces), not bearing subdivision alone; #7–#8 routing qualifies by the actual computed 45° dispersion footprint landing inside the bearing (no fixed length cap), and the routed strip gets a full mini load path check (moment + shear + development). Polish: a↔z_max rename; DCR = required/available width (no DCR=1 by definition); mirrored left/right overhang fixtures; independent N_a + both-support equilibrium tests; band junction rule; "detailing does not fit" label consistency in §5.

## Round 7 — Codex (final)
Rev 6 is sound enough to implement. The previous material blockers are addressed:

- Case C force signs and constant bottom-tie equilibrium are now consistent.
- Signed joint forces are derived independently and covered by mirrored fixtures.
- Segment-specific band widths now control node geometry.
- CCC vertices, the four-force `N_a` node, and the multi-face support node have distinct construction rules.
- Routed outboard loads now require a geometric dispersion test and a complete local load-path check.
- Design-stress band sizing, `βs` sequencing, benchmark statics, patterning, and verification gates are coherent.

Remaining items are implementation-detail polish, not blockers:

- Demonstrate explicitly in the default fixture that the outboard strips pass the new dispersion-footprint rule; the benchmark still uses the older shorthand `c ≤ limit`.
- Use standard truss notation `m + r = 2j` to avoid ambiguity over whether `n` means nodes or joints.
- Give the routed-strip cantilever shear check its precise ACI citation and define its critical section.
- Ensure the constructed node polygon—not merely the required strut width—determines the final available face width.
- Preserve signed member forces in diagnostics even when the UI reports compression/tension magnitudes.
- Keep release blocked until the edition-sensitive §23.5 and §9.9.1.1 text is checked against the licensed ACI 318-19 copy, as the plan already requires.

VERDICT: APPROVED
### Claude's response (Round 7)
APPROVED. All six polish items folded into Rev 7: default fixture demonstrates the dispersion-footprint rule explicitly; m + r = 2j notation; routed-strip shear cited (§22.5, critical section at support face, no d-offset credit) with development per §25.4.2; available face width always from constructed node polygons, never the required width; signed member forces preserved in diagnostics; ACI edition-sensitive text verification remains a release blocker as planned.

## Final resolution
Plan APPROVED on round 7 of 7 (user extended twice from MAX_ROUNDS=5). User directed implementation to proceed (builder: Claude with subagents, per the original request). This log is the review deliverable.

## Implementation audit (post-build, user-requested) — Codex
Full audit of engine/examples/links/results: 2 BLOCKER + 12 MAJOR + 5 MINOR + 1 NIT (all findings and fixes specified in AUDIT-FIXES.md). Key: db^1.5 exponent missing in ldh/ldt (invisible at #8, unconservative above); psi_r/psi_p disjuncts misapplied to tie spacing; vertex node faces unbounded by band depth; crown-exclusion hid sized-to-fit row; routing rule too liberal; support node FBD; validation gaps. Re-audit after fixes: one residual MAJOR (wall EF cover hardcoded 0.75) — fixed with entered-cover input + probe fixture. Final verdict: AUDIT: CLEAN at 312/0 fixtures. Note: default-case hook anchorage flipped FAIL 1.082 -> PASS 0.676 under the correctly applied Table 25.4.3.2 (hooked-bar spacing 6.33 in >= 6db earns psi_r = 1.0) — flagged for licensed-text verification.
