# Plan Review Log: Steel Channel Lintel at a New Opening in Existing Masonry

Act 1 (grill) complete — plan locked with the user 2026-08-19. MAX_ROUNDS=5.
PLAN_FILE=PLAN-CHANNEL-LINTEL.md · LOG_FILE=PLAN-CHANNEL-LINTEL-REVIEW-LOG.md

13 decisions resolved in Act 1: geometry/config, design basis, gravity load model,
composite section treatment, wind demand source, masonry-on-bolt limit states, bolt
layout + spacing solver, jamb end condition, jamb pier scope, LTB/bracing, deflection
limits, feature scope, verification plan.

## Round 1 — Codex (adversarial, read-only)

Model: CLI default (config unpinned), codex-cli 0.144.1. Thread 01a01bae-8138-7b42-b41f-87f183ea0123.

The plan is not sound enough to implement. The principal problem is that it treats an unverified masonry/bolt mechanism as a fully composite beam and then omits checks for the masonry that makes that mechanism possible.

1. **TMS anchor equations are outside their stated scope.** TMS 9.1.6.3 applies only to headed and bent-bar anchor bolts embedded in grout; a long through-rod passing through a drilled/grouted cell is neither.  
   Fix: Require representative ASTM C1892 test data or a separately justified through-bolt model; do not label Equations 9-1 through 9-8 as directly applicable.

2. **The plan incorrectly claims to check all TMS shear modes.** TMS 9.1.6.3.2 requires the minimum of Equations 9-4, 9-5, 9-6, and 9-7, but pryout Equation 9-6 is omitted.  
   Fix: Add pryout wherever the anchor model is valid, or explicitly replace the entire anchor-equation suite with a tested through-bolt capacity.

3. **Axial bolt strength is missing.** Wind and the proposed torsional couple put rods in tension, yet the plan does not calculate masonry tension breakout, steel tension, washer pull-through, face-shell punching, or grout-cone overlap.  
   Fix: Define the actual washer/plate anchorage and check every tension failure mode before applying Equation 9-8.

4. **Equation 9-8 is applied with an undefined and likely invalid \(B_{an}\).** The plan specifies tension demand but never defines a valid nominal tensile strength for the through-rod detail.  
   Fix: Establish tested or mechanically justified tension capacity first; only then perform combined tension-shear interaction.

5. **The claimed composite action is not demonstrated.** Through-rods in clearance holes cannot enforce the longitudinal strain compatibility assumed by \(I_\text{comp}\) until substantial slip and local masonry bearing occur.  
   Fix: Either design a positive, low-slip shear-connector detail with a defensible load-slip model or use the noncomposite \(2I_y\) section as the required design basis.

6. **Calling masonry merely a “shear web” does not avoid designing it.** The grout and CMU between the two faces must carry the transverse connector forces that exchange axial force between channels; omitting masonry spanning/shear is omission of the member that closes the composite couple.  
   Fix: Explicitly model and check grout-core shear, CMU face-shell bending/punching, bed-joint shear, local splitting, and connector-group interaction.

7. **The connector model ignores discontinuous grouted cells.** Bolts at 8-inch modules do not create a continuous shear web if only isolated cells are grouted, especially because longitudinal transfer must cross webs, head joints, and bed joints.  
   Fix: Require a continuous reinforced/grouted bond beam or another continuous collector and verify its longitudinal shear path.

8. **The plan provides no load path for wind from the wall panel into the bolt lines.** Wind pressure acts on masonry between bolts, but masonry spanning horizontally/vertically to those bolts is expressly out of scope.  
   Fix: Check the wall panel between connector rows/columns for out-of-plane flexure and shear, including boundary conditions and openings.

9. **“Shear flow is wind-only” is misleading.** It is true only for ideal longitudinal composite shear under perfectly equal gravity loading; the bolts still carry all gravity transfer, and unequal channel engagement, construction tolerances, point loads, and torsion cause longitudinal redistribution.  
   Fix: Say only that the ideal symmetric gravity model produces zero *elastic composite longitudinal shear flow*, and add a minimum/robustness connector demand for unequal sharing.

10. **The torsion eccentricity appears misinterpreted.** AISC’s channel \(e_o\) is not safely combined as \(e=e_o+t_w/2\) without confirming its database datum and sign; the resulting 1.194-inch lever arm is likely not the distance from the web bolt line to the shear center.  
    Fix: Derive the bolt-line-to-shear-center distance directly from the AISC coordinate definitions and verify it graphically for several C and MC shapes.

11. **The torsion couple is not a complete torsion analysis.** \(dF=w_se/g\) is only local equilibrium of a strip; it does not establish longitudinal torsional compatibility, warping restraint, end effects, discrete-fastener distribution, or channel torsional stresses.  
    Fix: Analyze the channel with discrete lateral restraints and torsional/warping response, or conservatively check AISC H3 in addition to the bolt couple.

12. **The torsion demand is internally ambiguous by a factor of two.** Earlier gravity load \(w_u\) is divided between channels, while the torsion equation later uses \(w_u e\) without stating whether \(w_u\) is total-pair or per-channel load.  
    Fix: Use separately named total and per-channel line loads and derive every bolt force from one explicit free-body diagram.

13. **The two channel torsions may impose opposite face forces through the same rods.** Simply calculating one row tension plus one row bearing per channel can double-count or cancel forces depending on channel orientation.  
    Fix: Draw both channel shear-center orientations and assemble rod forces from simultaneous equilibrium of the complete cross-section.

14. **Compression-channel buckling is underdefined.** Wind creates axial compression, but the plan cites H1 without defining \(P_n\), effective length, flexural buckling, or singly symmetric flexural-torsional buckling under AISC Chapter E.  
    Fix: Add Chapter E compression strength, including E4 flexural-torsional buckling and defensible bracing/effective lengths.

15. **Masonry contact does not automatically brace channel flanges or the compression channel.** Through-bolts through the web at intervals do not establish continuous flange lateral bracing, twist restraint, or axial buckling restraint.  
    Fix: Default to discrete bracing at verified bolt locations and require proof of continuous restraint before allowing F2.1.

16. **The plan omits channel tension-member limit states caused by the wind couple.** Bolt holes reduce net area, and tensile rupture, block shear, and connection eccentricity can govern.  
    Fix: Add AISC D2 net-section rupture, gross yielding, shear lag where applicable, and J4 block shear along the full connector pattern.

17. **Local channel-web failure is incomplete.** J3.10 bolt-hole bearing alone does not cover web yielding, local bending, tear paths between two vertical rows, or concentrated-force effects at end groups.  
    Fix: Check net-section/block-shear paths and applicable concentrated-force/local web limit states using the actual hole geometry.

18. **The jamb check omits moments from eccentric face-mounted reactions.** Vertical reactions act outside the pier centerline and create out-of-plane moment even without wind; unequal channel reactions worsen it.  
    Fix: Include reaction eccentricity from each channel face, bolt-group eccentricity, and worst-case unequal load sharing in pier and connection demands.

19. **The jamb model omits in-plane pier demand.** Vertical end reaction plus eccentric bolt-group transfer can produce in-plane shear/flexure, yet in-plane pier checks are categorically excluded.  
    Fix: Include in-plane shear and flexure or clearly terminate the calculator at published reactions without declaring the jamb adequate.

20. **TMS 9.3.4.4.2 is misidentified as the moment magnifier.** Section 9.3.4.4.2 gives the slender-wall procedure and applicability conditions; the alternative moment magnifier is in 9.3.4.4.3.  
    Fix: Correct the citation and implement the selected method’s full applicability limits, equations, and service deflection requirements.

21. **The pier height and support conditions are not properly defined.** Using wind “over the opening height” is not a valid substitute for the pier’s actual unsupported height, tributary width, top/bottom restraint, and axial-load eccentricity.  
    Fix: Require full pier geometry and boundary conditions and calculate loads over its actual tributary area.

22. **The wind input convention is internally inconsistent.** The user enters “strength-level” pressure, but the plan also promises the full ASCE 7 LRFD combination set and later calls the same value “unfactored” for deflection.  
    Fix: Accept service-level wind pressure with an explicit source/version and apply combination factors internally, or require separate strength and service pressures.

23. **C&C pressure may be the wrong pressure basis for the supported wall strip.** The correct pressure and effective wind area depend on whether the channel is treated as MWFRS, a component, or support for cladding.  
    Fix: Require the pressure classification, effective wind area, sign, enclosure basis, and load-case provenance rather than merely cross-referencing another calculator.

24. **Gravity and wind are checked separately for deflection despite occurring concurrently.** With axial compression from composite wind action, weak-axis response can be amplified, and biaxial displacement/service interaction is ignored.  
    Fix: Add combined service-load cases and second-order response where axial compression materially affects wind deflection.

25. **The deflection equations do not support the promised discrete point loads.** Phase 7 uses only the uniform-load \(5wL^4/384EI\) equation.  
    Fix: Calculate deflection by superposition for each point load at its actual location and for each service combination.

26. **The load model converts dispersed point loads into an “equivalent UDL” without defining equivalence.** Equal total load does not preserve reactions, peak moment, shear, or deflection for an off-center footprint.  
    Fix: Retain the actual dispersed patch load by default and make any UDL conversion check-specific and statically documented.

27. **The gravity load path assumes the wall can hang from bolt shanks without checking the wall strip between bolts.** Local masonry beam action, splitting above holes, and progressive loss after one bolt slips can govern.  
    Fix: Design the reinforced/grouted bond-beam strip above the opening for flexure, shear, local bearing, and connector force distribution.

28. **Bolt capacity cannot generally be treated as simple double shear.** A long threaded rod through deformable grout has distributed bearing, clearance, bending, and potentially unequal face reactions rather than two idealized steel-connected shear planes.  
    Fix: Use a validated long-grip through-rod model including bending and unequal load sharing, or conservatively avoid double-shear credit.

29. **“Bolt bending resisted by continuous grout bearing” is an unsafe unchecked assumption.** Drilled-hole tolerances and shrinkage can leave gaps, and CMU/grout bearing stiffness is not continuous or uniform.  
    Fix: Specify nonshrink fully packed sleeves/holes and calculate rod bending plus local bearing, or require a tested detail.

30. **Bolt spacing is treated as divisible by row count without group effects.** Two rows do not automatically split gravity, shear flow, tension, and torsion equally.  
    Fix: Solve the two-dimensional bolt group elastically, including direct forces, moments, row stiffness, and simultaneous load combinations.

31. **Breakout areas and overlapping cones are not addressed.** Closely spaced bolts, two rows, edges, cell boundaries, and jamb proximity invalidate independent per-bolt projected areas.  
    Fix: Calculate group projected areas with overlap, free edges, masonry thickness, and adjacent openings explicitly.

32. **The spacing solver assumes every capacity produces a linear spacing limit.** Breakout group capacity, bolt-group moments, edge distances, discrete grout layout, and combined interaction are nonlinear and configuration-dependent.  
    Fix: Enumerate permitted layouts and fully reanalyze each layout instead of solving each mode independently and snapping the result.

33. **The full ASCE 7 combination promise is underspecified.** It does not state which loads are D, roof live, snow, wind signs, accompanying-load factors, or whether point loads can belong to different load categories.  
    Fix: Define load categories and enumerate signed combinations explicitly, with each output tied to its governing combination.

34. **The auto-designer can return a false “lightest passing” shape.** It varies only channel size while connector layout, gage feasibility, edge distances, jamb capacity, bolt strength, and bracing interact with shape geometry.  
    Fix: Treat shape and feasible connector layout as a coupled search and reject geometrically impossible configurations before strength ranking.

35. **Construction-stage stability is a governing condition, not merely a shoring note.** The proposed composite system does not exist until holes are drilled, cells are grouted and cured, rods engage, and the opening is cut.  
    Fix: Require a defined installation/shoring sequence and check the unbraced channels for any permitted construction load stage.

36. **The reference reproduction fixture is not a validation of the new model.** Matching a calculation that lacks the proposed wind mechanism cannot validate composite action, through-bolt anchorage, torsion, or jamb response.  
    Fix: Add independent benchmark models or test-backed examples for each new mechanism, including a discrete-connector finite-element or closed-form comparison.

37. **The verification plan lacks explicit equilibrium and invariance tests.** “Degenerate + monotonicity” does not ensure that connector forces close the axial couple, torsion, reactions, and global moments.  
    Fix: Add numerical assertions for complete 3D equilibrium, connector-force integration, equal/opposite channel forces, sign reversal, and zero-slip/noncomposite limits.

38. **The plan knowingly leaves its weakest and potentially governing mechanism as a warning.** Disclosing an unverified load path does not make a strength calculator safe.  
    Fix: Make validated composite transfer a mandatory pass/fail calculation; otherwise force noncomposite wind design and label composite results informational only.

VERDICT: REVISE
### Claude's response — Round 1 (plan revised to rev 2, then rev 3 after the Fable review)

Claude is final arbiter. Codex advises; it does not command.

**ACCEPTED and built into the plan**

- **#6, #28, #29 — the connector mechanism was described wrongly, and this was the most valuable
  finding of the round.** Rev 1 called the masonry a "shear web" carrying longitudinal shear between
  the channels. That is wrong: channel A's axial force is delivered by the rod, whose far end reacts
  directly against channel B. **The rod is a direct double-shear connector; the grout's only job in
  the composite path is laterally supporting the rod over its grip.** Rewritten as its own section,
  and it adds a new limit state — rod flexure over the grip with an `L_u` sensitivity sweep.
- **#5 — slip before bearing.** Rejected the proposed fix (force non-composite; that deletes the
  feature the user asked for). Accepted the underlying concern and answered it with the code-sanctioned
  framework: **AISC 360-22 E6.1 modified slenderness and E6.2 connector spacing limits** for built-up
  members, plus mandatory standard holes, a non-shrink grout-filled annulus, mandatory non-composite
  reporting on every run, and a **hard fail** (not a warning) if connectors cannot develop `q`.
- **#1, #2, #3, #4 — the TMS anchor suite.** All correct. Eq. 9-6 pryout and Eq. 9-1 tension breakout
  were omitted; `B_an` was used but never defined. Rev 2 dismissed 9-1 and 9-6 by argument; rev 3
  **computes them** (far-face washer as head, embedment `= t`) because two reviewers pushed back and
  computing is cheaper than arguing. Added the explicit scope caveat that 9.1.6.3 is applied to a
  thru-rod **by analogy**.
- **#12, #13 — torsion ambiguity and possible cancellation.** Correct on both counts. Rewritten as a
  full free body with `w_ch` (per channel) named separately from `w_total`. The result: the two
  channels' torques are **opposite about global x but tension the same (top) row**, so they reinforce;
  `dF = w_ch*s*e/g` on the top row only, bottom row in bearing.
- **#14 — compression channel undefined.** Added AISC E3 + **E4 flexural-torsional** (the channel is
  singly symmetric) with `L = s` and a stated constrained-axis assumption.
- **#15 — bracing.** Accepted. Changed the default from "continuous restraint, `L_b = 0`" to
  **`L_b = s`** with full F2.2. This deviates from the user's Q10 answer and is flagged to him; it
  will return `M_p` in nearly every real case, so the cost is output length, not economy.
- **#8 — no wind load path from the wall panel into the bolts.** Correct and material. Added as a
  computed check (Phase 6). This deviates from the user's Q13 answer and is flagged; his decision was
  about *gravity* self weight, and the wind mechanism is genuinely different.
- **#16, #17 — channel tension and local web limit states.** Added D2 gross yielding and net-section
  rupture with Table D3.1 shear lag, and J4.3 block shear on the two-row pattern.
- **#18 — jamb reaction eccentricity.** Added, with a user-set unbalance defaulting to 10%.
- **#20 — TMS citation.** Verified and Codex is right: **9.3.4.4.3 is the moment magnifier; 9.3.4.4.2
  is the P-delta / slender-wall method** (tms_full.txt:8578-8626). Corrected.
- **#21, #22, #23 — pier geometry and wind convention.** All accepted. Actual unsupported pier height,
  tributary width and restraint are now required inputs; wind is strength-level input with the service
  application explicitly labeled; classification/zone/effective area/enclosure are recorded inputs.
- **#25, #26 — deflection and patch loads.** Accepted. Superposition over all load types; the
  "equivalent UDL" conversion is removed and patch loads are retained.
- **#30, #31, #32 — bolt group and solver.** Accepted. Elastic bolt-group solution, group-overlapped
  breakout areas at the jamb, and the linear spacing solver replaced by **layout enumeration with a
  full re-check per candidate**.
- **#33, #34 — combinations and auto-design.** Accepted. Signed enumerated combinations with load
  categories; auto-design searches shape and layout as a coupled pair.
- **#36, #37 — verification.** Accepted. Fixture B gains an independent discrete-connector comparison,
  Fixture C gains explicit equilibrium assertions.
- **#9 — "shear flow is wind-only" wording.** Accepted the wording fix; rejected the added
  "robustness connector demand" as unnecessary because the gravity demand already sets the floor.
- **#35 — construction stage.** Accepted as a **mandatory printed installation-sequence prerequisite**
  (new Phase 9). Rejected adding a construction load case — that is the user's Q10 call, and the
  sequence block covers the real risk.
- **#38 — weakest mechanism left as a warning.** Largely dissolved by the #6 rewrite. What remains is
  accepted as the hard-fail path plus mandatory non-composite reporting.

**REJECTED, with reasons logged**

- **#10 — `e_o` datum "likely wrong."** Rejected on evidence, not argument. Checked the classic
  thin-wall shear-center formula against the AISC v16.0 database for **all 72 C and MC shapes**:
  `e_cl = 3*t_f*b'^2/(6*b'*t_f + h*t_w)` referenced to the back of the web matches tabulated `e_o`
  to **0.64% worst case** (MC13x40). MC18x42.7 matches exactly at 0.969. `e = e_o + t_w/2 = 1.194 in`
  is confirmed. Codex asked for exactly this verification; it had already been done.
- **#19 — in-plane pier check.** Partially rejected. The in-plane eccentric moment is **computed and
  reported** with a hand-off flag, but not checked. In-plane pier capacity is a shear-wall problem
  this calc does not have the inputs for, and the user set that scope boundary explicitly in Q9.
- **#24 — combined biaxial service deflection.** Rejected. No code requires it and it is not practice
  for lintels. The real second-order concern is captured instead by **App. 8 B1 amplification** of
  `M_y` on the compression channel, which was accepted.
- **#27 — gravity inter-bolt masonry span.** Rejected as a computed check, per the user's explicit Q13
  decision, but the reasoning is now printed on the sheet rather than left implicit: the wall above is
  a deep element relative to an 8-24" bolt gap, and the rod bears **upward** into a compression field,
  so no splitting mechanism exists above the hole. Note that rev 3 nonetheless computes Eq. 9-4 in
  **both** gravity directions after Fable disputed the direction argument.
- **#11 — full torsional/warping analysis.** Partially rejected. Added an **H3.3 check over the
  bolt-column span `s`** rather than a full warping analysis; with restraints at 8-24" the torsional
  span is trivially short and a warping solution would be false precision.

---

### Fable plan-logic review (parallel, independent of Codex) — response

Two **severe** findings Codex missed, both accepted:

- **F1 — the double-shear credit is wrong for the longitudinal component.** Gravity load enters
  between the webs and splits, so `V_y` halves per plane. But the wind shear flow is a
  channel-to-channel transfer, so **each plane carries the full `q*s/rows`**. Rev 2 checked
  `V_x = q*s/rows` against a two-plane capacity, halving the wind demand. Corrected to a
  **per-plane** resultant `R_plane = sqrt((V_y/2)^2 + (q*s/rows)^2)` against single-plane capacities.
  At `p=30 psf, h_trib=5 ft, L=28 ft, s=16"` this is 3.41 k/plane against 8.95 k — not negligible.
- **F2 — gravity-direction breakout toward the cut soffit.** Fable argues the field-bolt reaction
  loads the masonry **downward** toward the fresh cut, making Eq. 9-4 live mid-span; Claude's earlier
  reasoning said the rod bears **upward** into a compression field with no free edge. Rather than
  adjudicate, the calc now **computes Eq. 9-4 with separate up and down `l_be` inputs and takes the
  minimum**. At 4" above the soffit, `phi*Bvnb = 2.19 k` would govern over `phi`-crushing at 2.36 k,
  so the disagreement is worth money and the conservative resolution is right.

Also accepted from Fable: **F3** AISC J3.7 rod-steel tension/shear interaction (distinct from TMS
Eq. 9-8, which is the masonry side) was missing; **F5** the compression `P_c` basis was unstated;
**F6** the jamb group's in-plane eccentricity `e_group` and the continuation of Phase 5 demands into
the end group; the missing `T_w` formula; running **both wind signs** through H1; and the nuance that
**TMS 4.6 is scoped to unreinforced masonry**, so `l/600` here is adopted rather than mandated.

Fable's sequencing findings were the most useful part and are now a build-order section: **Phase 3b
cannot precede Phase 4**; the **Tedds reconciliation becomes Phase 0** because it defines the
convention Fixture A asserts against; the auto-design/solver circularity needs a stated iteration
contract (user `s` held, required `s` reported per candidate); the theme decision belongs at
file-skeleton time; and — the single best implementation note — **the engine must be pure DOM-free
compute functions so Fixtures A and C run headless**. All nine of Fable's proposed numerical
assertions were adopted verbatim into Fixture C.

Fable independently **confirmed**, by its own derivation: the wind-only shear flow claim, `I_comp`
and `z_ch`, the decomposition closure `2*N_ch*z_ch + 2*M_y,ch = M_w`, the torsion couple, the `e_o`
datum, every Phase 1 catalog anchor value, and reference corrections 1 through 4.

Plan is now at **rev 3**.

---

## Round 2 — Codex

Rev 3 materially improves the plan: most prior implementation omissions are now addressed, and the \(e_o\) datum objection is satisfactorily resolved. However, the revised “direct double-shear connector” model still does not satisfy equilibrium without relying on grout reactions, and E6 does not validate the claimed composite stiffness.

1. **The “direct double-shear” mechanism is still mechanically incomplete.** Opposite longitudinal forces \(+V_x\) and \(-V_x\) applied at the two channel webs are separated through the wall thickness and therefore form a couple on the transverse rod; ordinary shear transfer alone does not equilibrate that couple.  
   Fix: Model the rod as a transverse beam with channel-hole bearing at both ends and explicit grout-bearing reactions along the grip, then verify force and moment equilibrium.

2. **The assertion that grout only “laterally supports” the rod understates its structural role.** Unless the web connections transmit end moments—which bolt-hole bearing does not—the grout reactions are required to equilibrate rod bending generated by the separated longitudinal connector forces.  
   Fix: Treat grout bearing stiffness and strength along the rod as part of the mandatory composite load path, not merely a support assumption.

3. **The proposed rod-flexure check is only a sensitivity exercise, not a defined resistance model.** An arbitrary \(L_u\) and a sanity bound \(V_xt/4\) do not define the rod’s actual moment diagram, bearing distribution, or maximum moment.  
   Fix: Adopt a conservative explicit rod model, such as an unsupported span equal to the full clear grip unless a qualified grouting detail establishes a shorter supported length.

4. **The default \(L_u\approx2.5\) inches is potentially unconservative.** Nonshrink grout in a drilled annulus does not demonstrate intimate bearing over all but one face-shell thickness at each end, particularly under reversed longitudinal shear.  
   Fix: Default to the full wall grip and permit reduced \(L_u\) only with a specified sleeve/annulus detail and substantiated bearing stiffness.

5. **AISC E6 does not solve connector slip or establish composite flexural stiffness.** E6.1 modifies built-up compression-member slenderness and E6.2 controls connector spacing; neither provides a load-slip relation or validates use of the full no-slip \(I_\text{comp}\) for service deflection.  
   Fix: Use a connector load-slip stiffness derived from testing or a defensible rod/grout bearing model and compute partial-composite stiffness; otherwise use \(2I_y\) for serviceability.

6. **Passing connector strength \(q\) does not prove strain compatibility.** A connection may have ample ultimate shear strength yet slip enough in standard holes to eliminate most of the claimed 20.4-fold stiffness gain.  
   Fix: Add a service-load slip limit and partial-interaction analysis independent of the ultimate connector-strength check.

7. **The discrete-spring fixture cannot validate the actual assembly without calibrated spring stiffness.** Showing that arbitrary infinite stiffness recovers \(I_\text{comp}\) merely confirms the mathematical limiting case.  
   Fix: Derive a lower-bound connector stiffness from the rod, channel-hole bearing, grout bearing, and clearance, then benchmark the calculator at that stiffness.

8. **“Standard holes” still permit initial slip incompatible with immediate full composite action.** Filling the masonry annulus does not eliminate the 1/16-inch channel-hole clearance, and snug-tight washers do not make the steel connection slip-critical.  
   Fix: Include hole-clearance slip explicitly or specify fitted holes/reamed sleeves or another positive no-slip detail.

9. **The per-plane longitudinal shear check is directionally improved but does not replace rod bending equilibrium.** Checking each end section for the full \(q s/\text{rows}\) captures shear stress but not the couple created across the grip.  
   Fix: Combine each plane’s shear with the moment from the complete transverse-rod model rather than treating flexure as a separate approximate bound.

10. **The rod combined-stress citation is muddled.** AISC H3 is a member torsion provision and is not the natural interaction basis for a round rod carrying transverse shear and bending; “H3 / von Mises” leaves the implementation undecided.  
    Fix: Specify one exact rod bending-plus-shear resistance method, including section modulus, shear area, yield criterion, and resistance factors.

11. **The plan still calls the assembly “double shear” in a way that can overstate capacity.** Gravity resembles central double shear, but longitudinal channel-to-channel transfer produces opposite end forces plus rod bending and is not conventional symmetric double shear.  
    Fix: Reserve “double shear” for the gravity component and describe longitudinal transfer as two single-plane end shears coupled through transverse rod flexure/grout bearing.

12. **E3/E4 with \(L=s\) is not justified for every buckling mode.** Rods through the web may restrain some out-of-plane translation, but they do not automatically brace vertical translation, twist, or warping with sufficient stiffness.  
    Fix: Determine effective length separately for each flexural and flexural-torsional mode, using the full span for any axis or mode lacking verified connector restraint.

13. **Likewise, \(L_b=s\) is not automatically valid for strong-axis LTB.** Web attachments do not constitute compression-flange and twist bracing merely because they occur at spacing \(s\).  
    Fix: Verify brace strength and stiffness for LTB at each rod column or use the full unbraced span.

14. **The two-row arrangement may provide torsional restraint, but its stiffness is never checked.** The torsion free body establishes required force, not whether rod axial stiffness, washer bearing, and wall-face deformation provide adequate rotational restraint.  
    Fix: Add brace-stiffness and deformation checks for the two-row torsional couple before using \(s\) as the torsional or LTB brace spacing.

15. **The torsion statics are much clearer, but the bottom-row reaction is not fully carried into connection checks.** The derivation gives top-row rod tension and bottom-row outward bearing, while Phase 5 assigns only \(dF\) tension to the top row and does not clearly add the corresponding bottom-row channel/wall bearing demand.  
    Fix: Apply equal \(dF\) out-of-plane compression/bearing demand to the bottom row and check channel web, washer/contact, face shell, and grout locally.

16. **\(T_w=p\,h_\text{trib}s/\text{rows}\) assumes all transverse wind transfer occurs as rod tension.** Depending on wind sign and contact, one channel may receive load by direct wall bearing while the opposite channel engages through rods; the actual split affects local demand and composite response.  
    Fix: Provide separate pressure and suction free bodies showing wall-to-channel contact, rod tension, and reactions for both wind signs.

17. **The TMS analogy remains non-code and is incorrectly described as necessarily conservative.** Modeling a far-face washer as a headed anchor with embedment equal to the full wall thickness can create a very large fictitious cone and may substantially overpredict a real face-shell or grout failure.  
    Fix: Label these capacities as informational analogy unless validated by ASTM C1892 testing, and make independently justified washer/face-shell/grout capacity govern.

18. **Equation 9-1’s projected area is not defined for the actual masonry geometry.** A cone based on full wall thickness may cross hollow cells, unit webs, bed joints, isolated grout boundaries, neighboring rods, and wall edges.  
    Fix: Construct \(A_{pt}\) from the actual grouted geometry and truncate/overlap it at every void, joint, edge, and adjacent connector—or do not credit it.

19. **The Eq. 9-8 basis is internally inconsistent.** The reference table says \(B_{an}\) is from Equation 9-2, while the later definition makes it the minimum of Equations 9-1, 9-2, and face-shell bearing.  
    Fix: Use one explicit design-strength definition consistently, with the applicable \(\phi\) applied separately to each failure mode before taking the minimum.

20. **TMS capacities should not all be described as “per single shear plane.”** Masonry crushing, breakout, and pryout depend on the total rod/masonry force field and geometry, not automatically on the steel shear-plane abstraction at each web.  
    Fix: Separate steel plane checks from masonry demand checks and derive masonry forces from the complete rod/grout free body.

21. **The gravity-direction breakout treatment avoids omission but is not mechanically rigorous.** Taking the minimum of upward and downward edge capacities regardless of actual masonry force direction can produce a conservative number, but it does not validate the load path or projected area.  
    Fix: Determine the actual rod-on-masonry force direction from equilibrium and check breakout in that direction, with load reversal only where a real reversed combination exists.

22. **Gravity inter-bolt masonry behavior remains unsupported.** “Deep element” and “arches trivially” are conclusions without an admissible compression-field geometry, thrust reaction, or shear/splitting check.  
    Fix: Either provide a conservative local masonry strip/compression-field check or make a continuous reinforced bond beam a mandatory applicability condition.

23. **The wind panel check still needs defined boundary conditions.** “Spanning horizontally between bolt columns” does not state whether the strip is simple, fixed, one-way, two-way, cracked, reinforced, or capable of transferring reactions into isolated grouted cells.  
    Fix: Specify the masonry panel model, effective section, reinforcement/grouting requirements, support stiffness, and TMS flexure/shear provisions.

24. **The default 10% channel reaction imbalance remains arbitrary and may be unconservative.** Clearance, installation sequence, wall irregularity, and asymmetric point loads can initially put nearly all gravity reaction into one channel.  
    Fix: Default to 100/0 load sharing unless positive load-distribution detailing or analysis supports a smaller imbalance.

25. **The plan’s auto-design contract remains contradictory.** It says shape and layout are searched as a coupled pair, then says user spacing is held fixed while shapes are ranked and merely reports required spacing.  
    Fix: Choose either a true coupled enumeration of shape–spacing–gage combinations or a fixed-layout shape search and name the feature accordingly.

26. **Fixture C assertion 6 encodes an overgeneralized breakout law.** Doubling \(l_{be}\) only quadruples \(A_{pv}\) before wall thickness, neighboring cones, grout boundaries, and other geometric caps intervene.  
    Fix: Restrict that assertion to an explicitly uncapped isolated-anchor geometry and add tests at every truncation/overlap transition.

27. **Fixture C assertion 8 calls a noncomposite pair a “single-channel” result.** \(2I_y\) represents two channels acting noncompositely, not one channel.  
    Fix: Rename the assertion and independently test true single-channel stiffness \(I_y\).

28. **The build order is internally inconsistent.** The diagram places Phase 4 before Phase 3a, while the heading says Phase 3a is built “AFTER Phase 4” but is numbered and described earlier; this is manageable for humans but poor as an implementation contract.  
    Fix: Renumber phases in actual dependency order or provide an explicit dependency graph without contradictory numeric sequencing.

Substantially addressed from the prior review: missing TMS Equations 9-1 and 9-6, undefined \(B_{an}\), J3.7 interaction, channel D2/J4.3 checks, E3/E4 identification, torsion load naming and free body, the \(e_o\) verification, TMS 9.3.4.4.3 citation, patch-load deflection, signed combinations, wind-panel scope, jamb eccentricity reporting, layout enumeration, pure-function architecture, installation prerequisites, and stronger machine-checkable verification.

The remaining blocker is not missing output detail; it is that full elastic composite action is still assumed without a valid stiffness/slip model, while the revised direct-connector description omits the grout reactions required to equilibrate longitudinal transfer through a long transverse rod.

VERDICT: REVISE
### Claude's response — Round 2 (plan revised to rev 4)

Round 2 correctly narrowed to one real blocker with two halves, and it was right on both.

**ACCEPTED — the blocker, and the reason rev 3 was wrong**

- **#1, #2, #9, #11 — the rod carries a couple, and rev 3's "direct double-shear connector" framing
  did not satisfy equilibrium.** Channel A applies `+V_x` at `z = +t/2` and channel B applies `-V_x`
  at `z = -t/2`: net force zero, **net moment `V_x*(t + t_w)`**. Bolt-hole bearing cannot transmit end
  moments, so **distributed grout bearing along the grip is required for equilibrium**. Rewritten a
  third time: the rod is a **transverse beam on a grout foundation loaded by two opposed end shears**,
  and grout bearing is now a **mandatory participant in the composite load path with its own checked
  demand**, not a support assumption. Terminology tightened — "double shear" is reserved for the
  gravity component only; longitudinal transfer is "two single-plane end shears coupled through
  transverse rod flexure and grout bearing."
- **#3, #4, #10 — rod flexure was a sensitivity exercise, not a resistance model, and `L_u = 2.5"`
  was unconservative.** Accepted in full. `L_u` now **defaults to the full clear grip `t + t_w`**, with
  a shorter length permitted only when a qualified sleeve/annulus detail is selected and printed as a
  requirement. The resistance method is now fully specified rather than "H3 / von Mises":
  `M_rod = V_x*L_u/2`, `S_rod = pi*d_b^3/32`, `Z_rod = d_b^3/6`, `A_v = 0.577*A_b`, `phi = 0.90`,
  combined by von Mises on the extreme fiber. The sensitivity sweep is retained *in addition to* the
  check, not instead of it.
- **#5, #6, #7, #8 — AISC E6 does not solve slip, and passing `q` does not prove strain
  compatibility.** Correct, and this was the second half of the blocker. E6 is retained only for its
  actual scope (built-up compression-member slenderness). **The user was asked to decide and chose:
  composite `I_comp` for all strength checks, non-composite `2*Iy` for the L/600 wind deflection
  check.** Slip is a displacement, not a strength loss, so bearing engages at ultimate; but at service
  load 1/16" clearance can erase the 20.4x stiffness gain and there is no defensible load-slip model.
  This resolves #5 through #8 without needing test data, a partial-interaction model, or a no-slip
  detail the contractor might not build. It is conservative and it will drive sizes; that is accepted.
- **#12, #13, #14 — `L = s` and `L_b = s` were assumed, not earned.** Accepted. **AISC Appendix 6
  brace strength and stiffness** must now be satisfied at each rod column (required stiffness derived
  from rod axial stiffness, washer bearing, and wall-face deformation in series) before `s` may be used
  as a brace spacing; **any mode without verified restraint reverts to the full span**. Effective
  length is determined per mode for E3 and E4 separately.
- **#15 — the bottom-row reaction was dropped.** Correct; rev 3 carried only the top-row tension.
  An equal `dF` **out-of-plane bearing demand on the bottom row** is now checked against channel web
  bearing, washer contact, face-shell bearing, and grout bearing.
- **#16 — pressure and suction need separate free bodies.** Accepted; `T_w` is now explicitly only the
  rod-tension branch, with the direct-bearing branch drawn as a separate contact demand.
- **#17, #18 — the Eq. 9-1 projected area is fictitious.** This is the best catch of the round and it
  reverses rev 3. Rev 3 computed Eq. 9-1 and 9-6 with the far-face washer as head and embedment `= t`.
  That is worse than dismissing them: a cone projected from the full wall thickness crosses hollow
  cells, unit webs, bed joints, isolated grout boundaries, adjacent rods and edges, and would
  **overpredict**. They are now **NOT CREDITED for a geometric reason** — `Apt` is not constructible —
  and tension is governed by mechanisms computable from real geometry: rod steel (Eq. 9-2 / AISC J3)
  and face-shell bearing under the actual washer footprint. The "conservative" label on the TMS
  analogy is also withdrawn; it is an **analogy, informational**, and independently justified
  washer/face-shell/grout capacity governs where it is lower.
- **#19 — `B_an` defined two different ways.** Correct, rev 3 had the table and the text disagreeing.
  One definition now, used in all three places, with `phi` applied per failure mode **before** the
  minimum.
- **#20 — TMS capacities are not per-shear-plane quantities.** Accepted. Steel plane checks (J3.6,
  Eq. 9-7) are now separated from masonry checks (9.1.8, Eq. 9-4, Eq. 9-5), which are evaluated
  against the rod's resultant masonry demand from the complete free body.
- **#22 — the gravity inter-bolt argument was a conclusion, not a check.** Accepted, and resolved
  better than by computing it: **a continuous reinforced grouted bond beam course at the rod lines is
  now a mandatory condition of use**, and the calc refuses composite mode without it. This is standard
  practice over an opening anyway, and it makes the arching claim unnecessary rather than unsupported.
  (Note this supersedes the user's Q13 answer in substance while honoring it in form — the check is
  still not computed; the condition removes the need for it. Flagged to the user.)
- **#23 — the wind panel model was named, not specified.** Accepted: one-way horizontal strip,
  fixed-fixed between rod columns, grouted-cell net section where it crosses grouted cells and
  face-shell bedded section elsewhere, checked against TMS 9.2 or 9.3 per actual reinforcement.
- **#25 — the auto-design contract contradicted itself.** Correct. Rev 3 said "coupled pair" then
  "hold `s` fixed." Now a **true coupled enumeration** over `{shapes} x {s} x {g}`, renamed
  **"Optimize section and layout"**, with a separate **"Check my layout"** mode for the fixed case.
- **#26, #27 — Fixture C errors.** Both accepted. Assertion 6 is now restricted to explicitly uncapped
  isolated-anchor geometry with added assertions at each truncation/overlap transition. Assertion 8
  was mislabeled — `2*Iy` is a **non-composite pair**, not a single channel; renamed, and a separate
  true single-channel `Iy` assertion added.
- **#28 — build order contradicted its own numbering.** Accepted; replaced with a single S0-S12
  dependency-ordered contract, with the historical `Phase N` headings retained only for log
  traceability.
- **#21 — breakout direction.** Partially accepted: the equilibrium direction is now stated, while
  both directions continue to be computed and the minimum taken. Computing both costs nothing and
  removes the need for either reviewer to be right about the direction argument.

**REJECTED, with reason logged**

- **#24 — default the channel load split to 100/0.** Rejected. The rod is loaded along its length by
  grout and supported at both ends, so **load sharing is enforced by rod equilibrium, not by fit-up**.
  A 100/0 split would require one channel's hole to be grossly oversized or one channel absent. The
  10% default is a generous allowance for wall irregularity; 100/0 remains **selectable** for an
  engineer who wants it, so nothing is lost.

Plan is now at **rev 4**. The two blockers Round 2 identified — rod equilibrium and slip — are both
closed, one by a corrected mechanics model with a defined resistance check, the other by a user
decision that removes the need for a load-slip model entirely.

---

## Round 3 — Codex

Rev 4 closes the two conceptual issues in intent, but the rod-on-grout model is not yet implementable as written, and the strength-only composite assumption misses the pre-slip load stage. Several stale rev-3 statements also directly contradict the revised model.

1. **The rod-on-foundation reaction distribution is still undefined.** A net end couple \(V_x(t+t_w)\) cannot be converted into grout bearing demand without specifying foundation stiffness, contact length, or a conservative reaction couple.  
   Fix: Define an explicit beam-on-foundation solution or a conservative statically admissible grout-reaction distribution, including peak bearing pressure and moment diagram.

2. **\(M_\text{rod}=V_xL_u/2\) is asserted without boundary conditions.** Its validity depends on how grout reactions equilibrate the end couple; it does not follow merely from “double curvature.”  
   Fix: Derive \(M_\text{rod}\) from the selected foundation/contact model and include the derivation in Fixture B.

3. **The full-grip unsupported model conflicts with mandatory grout participation.** If \(L_u\) is the full grip and the rod is unsupported over that length, the opposed end shears remain moment-unbalanced; if grout supplies reactions, the rod is not unsupported.  
   Fix: Separate two quantities: rod flexural span/contact model and grout reaction lever arm; require both to satisfy equilibrium.

4. **Grout bearing is named as a check but not mathematically specified.** TMS 9.1.8 requires a bearing area, yet the plan gives no effective contact length, pressure distribution, or treatment of bearing reversal.  
   Fix: Define \(A_{br}=d_bL_\text{contact}\), the peak-versus-average pressure relationship, contact reversal for both wind signs, and the applicable \(\phi\).

5. **The rod shear/von-Mises equations double-count the 0.577 factor.** Using \(A_v=0.577A_b\) and then \(\sqrt{3}(V/A_v)\) gives a pure-shear limit near \(0.30F_yA_b\), inconsistent with the separately stated \(0.54F_yA_b\) design shear capacity.  
   Fix: Use \(\tau=V/A_b\) in the von-Mises equation, or define an effective shear area consistently and verify that the pure-shear limit matches the adopted \(\phi V_n\).

6. **The plan specifies two incompatible rod interaction checks.** It gives a von-Mises bending/shear check and also AISC J3.7 tension/shear, but never defines how rod bending, transverse shear, and axial tension are combined simultaneously.  
   Fix: Provide one three-action interaction procedure or require all applicable pairwise checks plus a stated conservative combined envelope.

7. **Full composite strength from the first increment of wind is not justified by ultimate bearing engagement.** Load applied before the holes slip into bearing produces noncomposite weak-axis bending that does not disappear when composite action later engages.  
   Fix: Envelope a fully noncomposite strength case and the fully composite case, or perform staged loading with pre-slip noncomposite demand plus post-engagement composite increments.

8. **The hard-fail fallback does not cure the staged-slip issue.** A connector can ultimately develop \(q\) and pass the hard fail while still accumulating material noncomposite moment before engagement.  
   Fix: Make the noncomposite wind strength case mandatory alongside the composite H1 case, not only a fallback after connector failure.

9. **The fixed-fixed wind-panel model may be unconservative.** Discrete rods through isolated cells do not automatically supply rotational fixity to a horizontal masonry strip; continuity of masonry alone does not establish fixed supports.  
   Fix: Use simple-span demand unless rotational restraint stiffness is demonstrated, or envelope simple, fixed, and continuity cases.

10. **Appendix 6 brace verification remains underspecified.** “Rod axial stiffness, washer bearing, and wall-face deformation in series” does not define those stiffnesses or the brace force path, especially for twist restraint from two rod rows.  
    Fix: Supply explicit stiffness equations and resistance checks for translation and rotation, with the full span used whenever any required stiffness cannot be calculated.

11. **The mandatory bond-beam condition needs constructible geometry.** Two rod rows may occupy different courses, while “a bond beam course at the rod lines” is singular and does not define reinforcement, development into jambs, or how an existing wall is retrofitted before cutting.  
    Fix: Specify the required grouted courses, horizontal reinforcement, development/anchorage into each jamb, and permitted retrofit sequence.

12. **The plan still contains the rejected rev-3 load path.** The Goal calls the rods “direct double-shear connectors,” and Load Path item 7 says longitudinal shear is carried “in double shear” while grout only laterally supports the rod.  
    Fix: Rewrite the Goal and Load Path to match the transverse-beam-on-grout-foundation model and reserve double shear exclusively for gravity.

13. **Locked Decision 10 still defaults \(L_b=s\).** Later text correctly says \(L_b=s\) must be earned through Appendix 6.  
    Fix: Change the locked decision to default to the full span and reduce to \(s\) only after brace strength and stiffness pass.

14. **The code table still falsely calls E6 “the code answer to connector slip.”** Rev 4 correctly rejects that claim elsewhere.  
    Fix: Change the E6 entry to “built-up compression-member provisions only; not used to establish slip or composite stiffness.”

15. **The TMS applicability caveat still calls the analogy conservative.** A later paragraph correctly says it is informational and not demonstrably conservative.  
    Fix: Remove “conservative” and state that independently justified rod, washer, face-shell, grout, and bond-beam checks govern.

16. **The \(B_{an}\) definition is still inconsistent in the code table.** The table says Equation 9-8 uses \(B_{an}\) from Equation 9-2, while the detailed definition takes the minimum of rod steel and face-shell capacity.  
    Fix: Make the table reference the single design-strength definition, with mode-specific \(\phi\) applied before the minimum.

17. **Phase 5 retains stale rev-3 rod-flexure instructions.** It still describes a sensitivity sweep and “crude bound” rather than requiring the new explicit foundation/equilibrium model.  
    Fix: Replace Phase 5 item 25 with the complete rev-4 rod, grout-reaction, bearing, and combined-action procedure.

18. **The Key Decisions and Risks sections revert to rejected mechanics.** They say “the rod, not the grout, is the composite connector,” that E6 addresses slip, that the TMS analogy is conservative, and that grout’s only role is preventing rod bending.  
    Fix: Rewrite these summaries so no implementation-facing section preserves superseded rev-3 assumptions.

19. **The 10% reaction split remains judgment rather than a verified result.** Rod equilibrium enforces total equilibrium but does not by itself guarantee a 50/50 gravity reaction when channel-hole clearances, grout contact, and support stiffness differ.  
    Fix: Retain the selectable assumption but require the output to identify it as engineer judgment and include at least a configurable adverse split in auto-design verification.

20. **Fixture C still lacks a direct rod–grout equilibrium assertion.** Existing assertions check global channel behavior but not whether end shears, distributed grout reactions, and rod moments close locally.  
    Fix: Add assertions for \(\sum F_x=0\), \(\sum M=0\), integrated grout reaction, peak bearing, and agreement between the derived and numerical rod moment diagrams.

Rev 4 does address the previous review’s E6 misuse for service stiffness, fictitious \(A_{pt}\), brace qualification, bottom-row bearing, pressure/suction separation, bond-beam requirement, auto-design coupling, fixture labeling, and build-order problems. The remaining material issue is that the newly mandatory rod–grout mechanism is described but not yet defined well enough to calculate, while pre-engagement noncomposite strength demand is omitted.

VERDICT: REVISE
### Claude's response — Round 3 (plan revised to rev 5)

Round 3 split cleanly into one real logical hole, five arithmetic/specification gaps, and seven items
of stale text I left behind while patching. Codex was right on essentially all of it.

**ACCEPTED — the logical hole**

- **#1, #2, #3 — the rod-on-foundation model was asserted, not derived, and contradicted itself.**
  Rev 4 said `M_rod = V_x*L_u/2` with no boundary conditions AND defaulted `L_u` to the full grip while
  simultaneously calling grout participation mandatory. Those cannot both be true: an unsupported rod
  cannot equilibrate the end couple. Derived properly and added to the plan in closed form. Grout
  reaction antisymmetric, uniform intensity `±k` over two contact halves of total length `L_c`, with
  unsupported gap `L_u = (L_g − L_c)/2` at each end:
  ```
  k = 4*V_x*L_g / L_c^2        s* = L_c^2/(4*L_g)        M_rod = V_x*(L_u + s*/2)
  ```
  Verified continuous across both bounds: `L_u = 0` gives `V_x*L_g/8`; `L_u = L_g/2` gives
  `V_x*L_g/2`, exactly 4x. Worked numerically for an 8" wall (`L_g = 8.075"`, `V_x = 3.41 k`):
  full contact 3.44 k-in, one face shell each end 5.90 k-in with `k = 3.54 k/in`, no grout credit
  13.77 k-in. **The default is now one face-shell thickness each end, not the full grip** — full-grip
  is retained only as a *reported bound*, because as a design basis it credits zero grout while the
  mechanism requires grout, which is exactly the incoherence #3 identified.
- **#4 — grout bearing named but not specified.** Now fully defined: `A_br = d_b*L_c`, peak pressure
  `f_g = k/d_b`, against `0.60*0.8*f'm` per TMS 9.1.8 / 9.1.4.2, with **both wind signs run for
  contact reversal**.

**ACCEPTED — arithmetic and specification**

- **#5 — the von Mises check double-counted 0.577.** Correct and embarrassing: rev 4 used
  `A_v = 0.577*A_b` *and* the `3*tau^2` term, giving a pure-shear limit near `0.30*F_y*A_b` against a
  separately stated `0.54*F_y*A_b`. Replaced with the exact solid-circular max shear
  `tau = 4*V_x/(3*A_b)`, and the implied pure-shear limit (`0.39*F_y*A_b`) is now stated on the sheet
  so the two cannot be read as contradictory.
- **#6 — three actions, no combination rule.** One procedure now: `sigma = N_rod/A_b + M_rod/S_rod`,
  `tau = 4*V_x/(3*A_b)`, `sqrt(sigma^2 + 3*tau^2) <= 0.90*F_y`. J3.7 retained as the separate bolt
  tension/shear pair check, with the sheet naming which controlled.
- **#7, #8 — pre-slip non-composite demand.** Accepted in the form requested: the **non-composite wind
  strength case is now computed and reported on every run**, not merely as a post-failure fallback,
  and the sheet states outright whether the design relies on composite action for strength at all.
  Often it will not — MC18x42.7 at `F_y = 36` gives `phi*M_n,y = 22.3 k-ft` per channel, 44.5 k-ft for
  the pair — in which case the slip question is moot. The ductile-redistribution rationale is printed
  alongside rather than left implicit.
- **#9 — fixed-fixed wind panel may be unconservative.** Correct; discrete rods through isolated cells
  do not supply rotational fixity. Now **enveloped over simple, fixed-fixed, and interior-continuity**.
- **#10 — Appendix 6 underspecified.** Explicit series stiffness now given:
  `1/beta_prov = 1/k_rod + 1/k_washer + 1/k_wall` with `k_rod = A_b*E_s/L_g`, washer bearing from the
  actual footprint, and `k_wall` from `Em = 900*f'm`; translational check per A-6-7 and torsional
  `beta_T = beta_prov*g^2/2` per A-6-12 including `beta_sec`. **Any stiffness that cannot be
  calculated forces the full span.** [SUPERSEDED — these equation numbers match no AISC edition; see
  Round 7 finding #4 and the Cross-check round 1 section]
- **#11 — bond beam not constructible as written.** Correct — two rod rows may fall in different
  courses. Now specifies the grouted course count `ceil((g + d_b)/8) + 1`, minimum 2-#4 continuous or
  the Phase 6 requirement whichever is greater, development into each jamb per TMS 6.1.2 with `l_d`
  printed, and the retrofit cut-and-grout sequence folded into the installation block.
- **#20 — no local rod-grout equilibrium assertion.** Added as Fixture C assertion 11: `sum F_x = 0`
  and `sum M = 0` on the rod, integrated grout reaction, peak bearing consistency, and agreement
  between the derived `M_rod` and a numerically integrated moment diagram, hitting both closed-form
  bounds.

**ACCEPTED — stale text (my error, not a disagreement)**

- **#12** Goal and Load Path item 7 still carried the rejected "direct double-shear connector" and
  "grout laterally supports" language — rewritten to the transverse-beam-on-grout model, with "double
  shear" now explicitly reserved for the gravity component.
- **#13** Locked Decision 10 still defaulted `L_b = s` while the body text required App. 6 — the
  decision now defaults to the **full span**.
- **#14** Code table still called E6 "the code answer to connector slip" — now reads "built-up
  compression-member provisions ONLY; NOT used to establish slip or composite stiffness."
- **#15** The applicability caveat still said "conservative" — removed; the analogy is informational
  and the independently justified checks govern.
- **#16** The `B_an` table entry still pointed at Eq. 9-2 alone — now references the single definition
  with `phi` per mode before the minimum.
- **#17** Phase 5 item 25 still described a sensitivity sweep and a "crude bound" — replaced with the
  six-step rev-5 procedure (a) through (f).
- **#18** Key Decisions and Risks reverted to superseded mechanics — both rewritten so no
  implementation-facing section preserves rev-3 assumptions.
- **#21 (Round 2 carry-over)** breakout direction: equilibrium direction stated, both still computed.

**PARTIALLY ACCEPTED**

- **#19 — the 10% reaction split.** The rejection of a 100/0 *default* stands: the rod is loaded along
  its length by grout and supported at both ends, so sharing is enforced by rod equilibrium, and 100/0
  would require a grossly oversized hole or an absent channel. But Codex is right that this is an
  argument, not a verified result. Accepted the two mitigations it asked for: the **output labels the
  split as engineer judgment**, and Fixture C assertion 12 adds an **adverse-split sweep** (50/50,
  60/40, 100/0) reporting how the selected section changes.

Plan is now at **rev 5**. Codex confirmed rev 4 had already closed the E6 misuse, the fictitious
`Apt`, brace qualification, bottom-row bearing, pressure/suction separation, the bond-beam
requirement, auto-design coupling, fixture labeling, and build order.

---

## Round 4 — Codex

Rev 5 successfully closes the longitudinal rod–grout equilibrium derivation. The formulas for \(k\), \(s^*\), and \(M_\text{rod}\) are dimensionally and statically consistent. However, several material gaps remain, principally gravity-induced rod flexure and bond-beam strength.

1. **The rod model covers longitudinal wind shear but not gravity-induced rod bending.** Gravity is distributed from masonry/grout along the grip into two channel-web reactions, so a long rod experiences transverse shear and bending even though it is nominally in double shear.  
   Fix: Derive the gravity-plane rod/grout reaction and moment diagram, then combine its orthogonal bending and shear with the wind-plane demands.

2. **The three-action check omits gravity shear.** It uses \(\tau=4V_x/(3A_b)\), while the same rod simultaneously carries \(V_y\) at the channel planes.  
   Fix: Use the resultant rod shear from all simultaneous components, based on the complete internal shear diagrams rather than \(V_x\) alone.

3. **The rod can have biaxial bending.** Longitudinal connector shear bends the rod in one plane; gravity bearing bends it in the perpendicular plane. Adding only \(M_\text{rod}/S_\text{rod}\) misses the combined extreme-fiber stress.  
   Fix: Combine the two bending vectors, conservatively using \(\sqrt{M_x^2+M_y^2}\), before adding axial stress and applying von Mises.

4. **The bond beam is mandatory but not designed for its gravity function.** Specifying continuous grout and 2-#4 does not prove that the bond beam can distribute wall and point loads to discrete rods without flexure, shear, or splitting failure.  
   Fix: Check the reinforced bond beam between rod columns for gravity flexure, shear, local bearing, and reinforcement development under every load combination.

5. **The noncomposite strength case is only reported, not required to pass.** If it fails, the plan relies on an unsupported assertion that pre-slip weak-axis moment harmlessly redistributes after bearing engagement. Residual-stress behavior is not equivalent to a staged change in structural system.  
   Fix: Require both composite and noncomposite strength cases to pass, or implement a defensible staged-slip analysis.

6. **The noncomposite strength case appears to check only F6.** Each channel simultaneously carries strong-axis gravity moment, weak-axis wind moment, shear, and torsion; comparing \(M_w/2\) only with F6 capacity is incomplete.  
   Fix: Run the full biaxial interaction and applicable shear/torsion checks for the noncomposite load case.

7. **The assumed \(M_w/2\) noncomposite wind split is not assured.** Without a transverse stiffness model, direct wall contact may initially load one channel more heavily than the other.  
   Fix: Apply the same adverse channel-sharing sweep to the noncomposite wind-strength case, including a selectable 100/0 wind split.

8. **Appendix 6 stiffness is still not fully explicit.** \(k_\text{washer}\) and \(k_\text{wall}\) are described as being obtained from footprint and thickness but no equations or defensible effective areas are supplied.  
   Fix: Provide exact equations and boundary assumptions; otherwise treat those stiffnesses as uncomputable and retain the full-span brace length.

9. **Compression bracing is conflated with beam bracing.** The listed Appendix 6.3 beam-bracing equations do not by themselves establish effective lengths for E3/E4 compression-member buckling.  
   Fix: Apply the appropriate Appendix 6 compression-member bracing provisions separately from the LTB/torsional beam-bracing checks.

10. **The physical contact limit is misstated at the mathematical bounds.** Grout exists only across wall thickness \(t\), while \(L_g=t+t_w\); therefore \(L_c=L_g\) and \(L_u=0\) cannot represent physical full grout contact through the channel webs.  
    Fix: Distinguish the mathematical bound from the physical maximum \(L_c\le t\), enforce \(L_u\ge t_w/2\), and test the physical bound separately.

11. **The default face-shell thickness is not universally 1.25 inches.** Actual CMU face-shell dimensions vary with unit type, thickness, and manufacturer.  
    Fix: Make face-shell thickness a required input or obtain it from a documented unit schedule; do not hard-code the default as a verified dimension.

12. **Phase 5 item 23 still contains superseded rev-3 requirements.** It says all capacities are per shear plane and lists Equations 9-1 and 9-6 as capacities that may govern, contradicting the revised masonry-resultant model and the decision not to credit those equations.  
    Fix: Rewrite item 23 to separate steel-plane checks from masonry-resultant checks and remove Equations 9-1 and 9-6 from credited capacity.

13. **The grout-bearing model assumes uniform plastic contact without stating that assumption.** A real elastic foundation will not produce uniform \(\pm k\); the proposed field is a statically admissible strength distribution, not an elastic response.  
    Fix: Label it explicitly as a lower-bound strength model and verify that deformation capacity permits redistribution to the assumed uniform bearing field.

14. **The no-contact limit is singular in grout demand.** As \(L_c\to0\), \(k\to\infty\), so the quoted finite \(V_xL_g/2\) rod-moment bound does not represent a viable composite connector.  
    Fix: State that the no-contact point is a rod-moment comparison only and must always fail the grout-bearing/composite-action check.

15. **Fixture C should include combined gravity-and-wind rod closure.** The new assertions validate only the antisymmetric longitudinal wind model.  
    Fix: Add equilibrium, biaxial bending, resultant shear, and combined-stress assertions under a governing simultaneous gravity-plus-wind combination.

Rev 5 resolves the prior review’s primary rod-equilibrium derivation, grout pressure definition, von-Mises double counting, stale summary text, wind-panel envelope, brace fallback, bond-beam constructibility, build sequence, and verification structure. The remaining omissions can still change the selected rod, bond-beam reinforcement, channel size, and whether composite strength is valid.

VERDICT: REVISE
### Claude's response — Round 4 (plan revised to rev 6)

Round 4's first finding changed the engineering answer, not just the document. **Everything accepted;
nothing rejected this round.**

**THE FINDING THAT CHANGES THE ANSWER**

- **#1, #2, #3 — the rod model covered wind but not gravity, and the rod bends biaxially.** Correct
  and I missed it entirely through five revisions. Under gravity the rod is loaded by distributed
  grout bearing over `t` and reacted at the two channel webs, so it bends in the **vertical** plane —
  perpendicular to the wind-plane bending. Added:
  ```
  M_grav = (P_rod/2)*(L_g/2 - t/4)         P_rod = w_total*s/rows
  M_res  = sqrt(M_wind^2 + M_grav^2)       V_res = sqrt(V_x^2 + V_y^2)
  ```
  Worked at the physical contact bound for the reference geometry (8" wall, `L = 28 ft`, `s = 16"`,
  `p = 30 psf`, `w_total = 1.344 klf`): `M_wind = 1.92`, `M_grav = 0.96`, **`M_res = 2.14 k-in`**.

  | Rod | von Mises | vs `0.9*F_y` | |
  |---|---|---|---|
  | **3/4" A307 — the reference calc's rod** | 52.5 ksi | 32.4 | **FAIL, DCR 1.62** |
  | 7/8" A307 | 33.2 ksi | 32.4 | **FAIL** |
  | 1" A307 | 22.4 ksi | 32.4 | OK |
  | 3/4" A449 | 52.5 ksi | 82.8 | OK |

  **Rod flexure governs the connector, and the reference Tedds rod does not work.** Added as
  correction #6 to the reference-errors list — the largest single correction in the plan. The calc
  must now offer **A449 and A193-B7 rod grades and diameters to 1-1/4"**, and rod diameter and grade
  become **search variables** in the auto-designer alongside shape, `s` and `g`. Fixture C assertion
  15 pins this as a regression test.

**ALSO ACCEPTED**

- **#5 — pre-slip demand cannot be waved away with a residual-stress analogy.** Correct; a staged
  change of structural system is not the same thing. Replaced the hand-wave with an actual
  **staged-slip analysis**: end slip `theta_end*(2*z_ch)` versus hole clearance `c_h` defines a
  transition load `w_slip`; Stage 1 is non-composite with `M_y,locked = w_slip*L^2/16`; Stage 2 is
  composite on the increment; the locked-in moment is carried into the total. Converges to pure
  non-composite at `w_w = w_slip` and to pure composite as `c_h -> 0` (Fixture C assertion 14).
- **#6 — the non-composite case ran only F6.** Now runs the full check set: strong-axis gravity,
  weak-axis wind, shear, torsion, H1 biaxial, identical to the composite case.
- **#7 — the `M_w/2` non-composite wind split was assumed.** Adverse-sharing sweep now covers wind as
  well as gravity, with a selectable 100/0 wind split.
- **#4 — the bond beam was mandated but not designed.** Correct, and this is what finally closes the
  gravity inter-bolt question properly. The bond beam is now **checked between rod columns** for
  gravity flexure (continuous-span envelope), shear at the rod columns, local bearing into each rod,
  and reinforcement development per TMS 9.3, with its required area feeding the "2-#4 or computed,
  whichever is greater" rule.
- **#8 — App. 6 stiffnesses still not explicit.** Now given as equations: `k_rod = A_b*E_s/L_g`,
  `k_washer = E_s*A_wsh/t_wsh`, `k_wall = Em*A_wsh/t_fs` with `Em = 900*f'm`. Labeled explicitly as an
  **idealization** (uniformly compressed pad, ignoring plate flexibility and local crushing), with the
  full span remaining the default and the engineer required to affirmatively accept the basis.
- **#9 — column and beam bracing conflated.** Correct: App. 6.2 governs column bracing, 6.3 governs
  beam bracing. Now separate checks, cited separately, with per-mode fallback to the full span.
- **#10 — the physical contact limit was misstated.** Sharp catch: grout exists only across `t`, not
  through the webs, so `L_c <= t` and `L_u >= t_w/2` are now **enforced**. `L_u = 0` is labeled a
  mathematical verification limit, never a design state. Physical bound for an 8" wall: `L_u = 0.225`,
  `L_c = 7.625`, `s* = 1.800`, `k = 0.946 k/in` — and those are the numbers used in the worked anchor.
- **#11 — face-shell thickness hard-coded at 1.25".** Now a **required input** with ASTM C90 minimum
  defaults per nominal thickness, editable, source named.
- **#12 — Phase 5 item 23 still stale.** My error again. Rewritten into two families: steel checks per
  shear plane, masonry checks on the rod's resultant force field, `B_an` from rod steel and face-shell
  bearing, and Eq. 9-1 / 9-6 moved to the not-credited list with their reason.
- **#13 — the uniform `±k` field is plastic, not elastic.** Now labeled a statically admissible
  lower-bound distribution, with a redistribution-capacity confirmation.
- **#14 — the `L_c -> 0` point is singular.** Correct, `k -> infinity`. Now stated as a rod-moment
  comparison value only, and the calc **enforces that it always fails** the grout-bearing and
  composite-action checks rather than reporting it as viable.
- **#15 — Fixture C validated only the wind model.** Added assertion 13: combined gravity-plus-wind
  rod closure in both planes, biaxial moment and resultant shear against numerically integrated
  diagrams, and von Mises against an independent extreme-fibre computation.

Plan is now at **rev 6**. Codex confirmed rev 5 had closed the rod-equilibrium derivation, grout
pressure definition, von Mises double-counting, all stale summary text, the wind-panel envelope, the
brace fallback, bond-beam constructibility, build sequence, and verification structure.

---

## Round 5 — Codex (MAX_ROUNDS)

Rev 6 materially improves the engineering and correctly identifies rod flexure as a governing limit state. The gravity-bending derivation is sound. However, the staged-slip model contains a fundamental kinematic error, and the plan has a factor-of-two connector-demand contradiction that is embedded in its verification fixture.

1. **The staged-slip kinematics are not valid for two unconnected channels.** Before engagement, the channels do not rotate as one cross-section, so relative end slip is not \(\theta_\text{end}(2z_{ch})\); that expression assumes the composite plane-section behavior whose onset it is trying to predict.  
   Fix: Derive differential bolt-hole displacement from each independent channel’s axial displacement at its web bolt line, including local centroid-to-web offset, load sharing, and wind sign.

2. **Using the wall-centerline separation in the pre-slip calculation grossly overstates the slip lever arm.** For an independent channel, bending-related longitudinal displacement at the rod is governed by the distance from that channel’s centroid to its web bolt line—not the distance between channel centroids across the wall.  
   Fix: Replace \(2z_{ch}\) with the relative web-point displacement obtained from the two separate channel solutions.

3. **The staged-slip model cannot support composite-reliant strength until corrected.** If the transition load is wrong, the locked-in weak-axis moment, post-engagement axial couple, shear flow, and H1 demands are all wrong.  
   Fix: Until the correct differential-displacement model is implemented and verified, require the full noncomposite strength case to pass.

4. **The connector anchor contains a factor-of-two arithmetic error.** With \(q=0.213\) kip/in, \(s=16\) inches, and two rows, \(V_x=qs/\text{rows}=1.70\) kip—not 3.41 kip.  
   Fix: Correct the scale check and every dependent example to 1.70 kip per rod/plane.

5. **Fixture C assertion 3 locks in that same wrong value.** A regression test requiring 3.41 kip would force the implementation to omit division by the two rod rows, contradicting the stated connector equation and worked rev-6 rod example.  
   Fix: Change the expected value to 1.704 kip and add a row-count scaling assertion.

6. **The plan now contains two conflicting worked connector demands.** The early scale check and Fixture C use 3.41 kip, while the rod-governance example correctly uses approximately 1.70 kip.  
   Fix: Recalculate all worked examples from one canonical demand function and assert that the displayed examples match its output.

7. **Phase 5 item 25 still implements the obsolete wind-only rod check.** It uses \(M_\text{rod}\), \(V_x\), and one bending plane rather than the new \(M_\text{res}\), \(V_\text{res}\), gravity bending, and axial force procedure.  
   Fix: Rewrite item 25 to require \(M_\text{wind}\), \(M_\text{grav}\), \(M_\text{res}\), \(V_\text{res}\), \(N_\text{rod}\), grout bearing, and the final combined von-Mises check.

8. **The worked rod stresses do not state the axial rod force used.** The top rod also carries wind tension and the gravity-torsion couple \(dF\); omitting \(N_\text{rod}/A_b\) understates the reported 52.5 ksi stress.  
   Fix: Tabulate \(N_\text{rod}\), \(M_\text{wind}\), \(M_\text{grav}\), and \(V_\text{res}\) explicitly and regenerate the grade/diameter results.

9. **The regression fixture may therefore pin an incomplete numerical result.** Assertion 15 requires exactly 52.5 and 22.4 ksi without documenting whether \(T_w+dF\) is included.  
   Fix: Base the regression on fully listed inputs—including gage, wind-tension branch, torsion tension, rod grade properties, and governing combination—and hand-check the resulting stresses.

10. **The bond-beam check must include patch and point-load effects.** The stated \(w_\text{total}s^2/8\) check addresses uniform loading only, while the calculator accepts dispersed patch loads that can govern a single rod interval.  
    Fix: Envelope the bond beam for all retained patch loads at their actual positions, including reactions, shear, flexure, and local rod bearing.

11. **Locked Decision 13 is now stale.** It says the gravity inter-bolt span is not computed, while Phase 6 correctly designs the bond beam between rod columns.  
    Fix: State that gravity transfer between rods is checked through the reinforced bond-beam model.

12. **The plastic grout-field deformation check remains undefined.** The plan says grout deformation capacity must permit redistribution to uniform \(\pm k\), but supplies no strain, rotation, ductility, or acceptance criterion.  
    Fix: Define a measurable deformation-capacity check or characterize the uniform field as an assumed ultimate lower-bound mechanism requiring engineer acceptance.

Everything else from Round 4 is substantially addressed: biaxial rod bending, resultant shear, physical grout-contact limits, face-shell input, separated brace provisions, explicit brace idealization, bond-beam design, adverse wind sharing, revised capacity families, local equilibrium assertions, and expanded rod-grade/diameter optimization.

The remaining decisive blocker is the staged-slip equation: it assumes composite cross-sectional rotation to calculate when composite action begins. The factor-of-two \(V_x\) contradiction would also cause the implementation or its regression suite to be wrong.

VERDICT: REVISE
### Claude's response — Round 5 (plan revised to rev 7) · MAX_ROUNDS reached

**Every Round 5 finding accepted. Nothing rejected.** Two of them mattered.

**#1, #2, #3 — the staged-slip kinematics were circular, and correcting them changes the design
conclusion.** Rev 6 computed pre-engagement end slip as `theta_end*(2*z_ch)` — using the composite
plane-section behaviour whose onset it was trying to predict. Before engagement the two channels bend
independently about their own centroidal axes, so the relative longitudinal displacement at the rod
is set by each channel's own centroid-to-web-bolt-line offset:

```
zeta_A = t_w/2 - xbar    zeta_B = xbar - t_w/2    relative lever = 2*(xbar - t_w/2)
MC18x42.7:  1.304 in    versus the 9.379 in rev 6 used  ->  overstated 7.2x
```

Consequence, MC18x42.7 at L = 28 ft:

| hole condition | c_h | w_slip |
|---|---|---|
| standard 1/16" oversize | 0.0625" | 0.302 klf |
| both holes adverse | 0.125" | 0.604 klf |
| reamed 1/32" | 0.03125" | 0.151 klf |
| epoxy-filled / fitted | 0.005" | 0.024 klf |

Design wind at 30 psf over 5 ft tributary is 0.150 klf. **With standard oversize holes, composite
action never engages** — not for deflection, and not for strength either. This invalidates the
premise of the user's earlier slip decision ("composite strength, non-composite deflection, no
special detail required"), so it is being taken back to the user rather than resolved unilaterally.
Codex's #3 fix — require the full non-composite strength case to pass — is what the corrected physics
independently demands, and is adopted pending the user's detailing decision.

**#4, #5, #6 — a factor-of-two contradiction embedded in the verification fixture.** Correct and
serious: `q*s = 3.41 k` is the demand on the whole rod COLUMN; per rod per plane it is
`q*s/rows = 1.704 k`. Rev 6 carried 3.41 k in the scale check and in Fixture C assertion 3, while the
rod worked example correctly used 1.70 k. Had that shipped, the regression test would have forced the
implementation to omit the row division. All worked examples now derive from one canonical demand
function, and a row-count scaling assertion is added.

Also accepted: **#7** Phase 5 item 25 still ran the obsolete wind-only rod check — rewritten to the
full biaxial `M_wind`/`M_grav`/`M_res`/`V_res`/`N_rod` procedure. **#8, #9** the worked rod stresses
omitted `N_rod` — every input is now tabulated (`g = 12"`, `T_w = 0.100 k`, `dF = 0.089 k`,
`N_rod = 0.189 k`), the stresses regenerated (3/4" A307 = 52.94 ksi, DCR 1.63; 1" A307 = 22.66 ksi),
and the regression fixture rebased on the complete input set. **#10** the bond beam now envelopes
dispersed patch loads at their actual positions, not just `w_total*s^2/8`. **#11** Locked Decision 13
was stale — gravity transfer between rods IS checked, via the designed bond beam. **#12** the grout
redistribution requirement now prints a computed deformation with an explicit engineer-acceptance
flag rather than an undefined aspiration.

**Status at MAX_ROUNDS: NOT APPROVED, and convergence is not being faked.** The plan improved on every
round and Codex confirmed each round's fixes landed. The one open item is not a Claude-versus-Codex
disagreement — both agree — it is a design decision that belongs to the engineer: whether to mandate a
fitted / epoxy-filled connector detail to obtain composite action, or to abandon composite action and
size the channels non-compositely.

---

## Final verification — Fable (independent, read-only, on rev 8)

Fable re-derived all four new derivations **from scratch rather than checking the algebra**, and
reproduced every one:

- **Rod-on-grout closed form** — `k = 4V_x·L_g/L_c²`, `s* = L_c²/(4L_g)`, `M_rod = V_x(L_u + s*/2)`,
  both bounds. Also confirmed `s* ≤ L_c/4`, so the maximum always falls inside the contact length —
  a check I had not made.
- **`M_grav = (P_rod/2)(L_g/2 − t/4)`** — 0.9548 vs the plan's 0.955.
- **Slip lever `2(x̄ − t_w/2) = 1.304 in`**, ratio to `2·z_ch` = 7.19 ("7.2x"), and all four `w_slip`
  values 0.302 / 0.604 / 0.151 / 0.024 klf.
- **The full rod anchor table** — `V_x = 1.7034`, `V_y = 0.448`, `V_res = 1.762`, `T_w = 0.100`,
  `dF = 0.0891`, `N_rod = 0.189`, `M_res = 2.1417`, and every von Mises value including
  3/4" A307 = 52.95 and 1" = 22.66. Also independently confirmed the implied pure-shear coefficient
  0.3897 ≈ 0.39.

It re-verified every TMS citation against `tms_full.txt` (Eqs. 9-1/2/4/5/6/7/8, the four φ values of
9.1.4.1, φ=0.60 of 9.1.4.2, `f_u ≤ min(1.9f_y, 125 ksi)`, 9.1.8, the 9.3.4.4.2 / 9.3.4.4.3 split at
lines 8578-8626, 4.6's unreinforced scope, 5.1.1.1's 2:1 and 3:1, and Eq. 9-21 collapsing to `wh²/8`),
all ten MC18x42.7 anchor values against the xlsx, the 32 C + 40 MC count, the `e_o` formula at
MC13x40 (0.64%), and the `CalcMeta` contract against `app/lib/calcs.ts:4-27`.

### The finding that changed the headline

**#1 — the worked anchor fails its own grout-bearing check, and rev 8 never ran it.** Accepted in
full; this is the best catch of the entire review, from either model.

`f_g = k/d_b = 0.946/0.75 = 1.262 ksi` against `0.60·0.8·f'm = 0.912 ksi` — **DCR 1.38**. And because
`k` is independent of `d_b`, a bigger rod barely helps: **1" A307 still fails at DCR 1.04**. Rev 8's
headline — "rod flexure governs; 1" A307 or 3/4" A449 fixes it" — was contradicted by the plan's own
check two items later.

Verified independently before accepting:

| `s` | `L_u` | rod | grout DCR | rod DCR |
|---|---|---|---|---|
| 16" | physical | 3/4" | **1.38 FAIL** | **1.63 FAIL** |
| 16" | physical | 1" | **1.04 FAIL** | 0.70 ok |
| 16" | physical | 1-1/4" | 0.83 ok | 0.36 ok |
| 16" | 1.25" default | any ≤1-1/4" | **1.55-2.59 FAIL** | — |
| **8"** | physical | **3/4"** | **0.69 ok** | **0.82 ok** |

**Grout bearing governs before rod flexure, and the relief is spacing, not rod grade.** The reference
calc's 3/4" A307 rod is workable at 8" o.c. — it specified 16". The worked anchor now runs `f_g`
alongside the rod check, states that grout bearing governs the 16" layout, and carries the 8"
comparison. Fixture 15 is split into a rod-steel assertion, a grout companion asserting the 1" rod
still fails, and a spacing-relief assertion.

**A second consequence Fable did not draw, but which follows:** the rev-8 mandated epoxy-filled
annulus is exactly the condition that justifies near-full grout contact. So `L_u` now **defaults to
the physical bound `t_w/2`**, and the unfilled `L_u = 1.25"` case is retained as a printed comparison
where *every* diameter fails — the calc demonstrating in its own numbers why the epoxy fill is
mandatory rather than advisory. The two decisions interlock.

### Also accepted (all of them)

- **#2, #3 — two stale rev-5 slip statements** in Key Decisions and Risk 5 still said "composite for
  strength, non-composite for wind deflection … buys freedom from a no-slip detail the contractor may
  not build," contradicting rev-8 Decision 14. Both rewritten. Stale text has now been caught in three
  separate rounds; that is a process signal, not bad luck.
- **#4 — AISC Appendix 6 citation is wrong and unconservative in direction.** `0.01·M_r·C_d/h_o` cited
  to A-6-7 matches no edition, and discrete rods are **point** braces (6.3.1b), whose stiffness demand
  is ~2.5x the panel value. Since neither Fable nor I can open 360-22, the plan now **forbids
  transcribing the equation from itself** and flags it as an open implementation item to be read from
  the spec.
- **#5** Errors #6 carried pre-rev-7 numbers (52.5 / 1.62) — now 52.93 / 1.63, with the remedy
  corrected from "bigger rod" to "tighter spacing."
- **#6** Item 24's "φ-crushing at 2.36 k" was wrong by exactly 2 — a per-plane halving that item 23
  forbids for masonry checks. Now 4.71 k. Breakout at 2.19 k still governs, so the conclusion survives.
- **#7** `1120/2 + 1.2·42.7` evaluates to 0.611, not 0.723. Now `1.2·(1120/2 + 42.7)`. This is the
  convention Fixture A asserts against, so the expression had to be right.
- **#8** Gravity used `t/4` while wind credited `L_c` for the same annulus — now `L_c/4` for both.
- **#9** The staged-slip engine had no build-order home despite feeding S4/S5 and S9 — assigned to S3.
- **#10** "Face-shell punching" had no equation and TMS has no punching provision — dropped; bearing on
  the actual washer footprint per 9.1.8 is the defensible check.
- **#11** "Does not engage at realistic design wind at all" was true by 0.7% at 60 psf — softened to
  "never dependable at design wind," with the margin stated.
- **#12** The engine precedent is an *external* file (`public/Calcs/js/deep_beam_stm_engine.js` via
  `<script src>`), not an inline block — architecture note corrected. And `F_y = 36` for A307 is
  customary, not specified (A307 specifies `F_u = 60` min, no yield) — now stated and editable.

### Readiness

Fable's verdict: **buildable as written once #1-#3 are patched** — which they now are. S0-S12 holds.
Highest-risk piece named as the Phase 5 connector engine and specifically the `L_u`-to-grout-bearing
coupling: the auto-designer will steer on **spacing and `f'm`**, not rod grade, and an implementer who
has not internalised that will read the first default run as a bug when it is the physics.

Plan is at **rev 9**.

---

## Round 6 — Codex (user-authorised, past the MAX_ROUNDS cap)

Rev 9 correctly identifies and quantifies the grout-bearing failure. The \(k\), \(f_g\), rod-stress, and 8-inch-spacing results are internally reproducible. The conservative full-span fallback also makes the unresolved Appendix 6 citations a manageable implementation gate rather than a safety blocker.

However, the low-slip detail still does not justify the clearance used in the engagement calculation, and the deflection procedure discards pre-engagement deformation.

1. **Epoxy in the masonry annulus does not eliminate clearance at the channel-web holes.** Longitudinal shear enters the rod through channel-web bearing, so a 1/32-inch steel-hole clearance must still be traversed unless the steel-to-rod gap itself is filled, fitted, or otherwise positively engaged.  
   Fix: Base \(c_h\) on the channel-hole clearance, or explicitly specify and qualify an epoxy-filled/fitted steel-to-rod interface at both channel webs.

2. **The claimed \(c_h=0.005\) inch is unsupported by the stated detail.** The installation sequence says to epoxy-fill the masonry annulus, not the channel holes; reamed holes are still allowed up to 1/32 inch.  
   Fix: Define exactly where the 0.005-inch clearance occurs, how it is constructed and inspected, and what material transfers longitudinal bearing at the web.

3. **At the stated maximum 1/32-inch web-hole clearance, the worked 30-psf wind case does not engage.** The plan’s own table gives \(w_\text{slip}=0.151\) klf versus \(w_w=0.150\) klf.  
   Fix: Require a genuinely fitted steel connection with a smaller verified clearance, or design that case as noncomposite.

4. **Engagement does not justify pure-composite deflection for the entire load history.** The stage-1 noncomposite deflection remains after the connector engages, just as the plan correctly retains stage-1 weak-axis moment for strength.  
   Fix: Calculate final wind deflection as the noncomposite deflection accumulated through \(w_\text{slip}\) plus composite deflection from the load increment \(w_w-w_\text{slip}\).

5. **The deflection error is potentially large even at \(c_h=0.005\) inch.** With \(w_\text{slip}=0.024\) klf, about 16% of the wind load acts at approximately 20.4 times the composite flexibility before engagement.  
   Fix: Add a staged-deflection regression fixture and prohibit substituting the pure \(I_\text{comp}\) result whenever \(w_\text{slip}>0\).

6. **The engagement criterion is too weak.** Checking only \(w_\text{slip}\le w_w\) allows “composite” classification when engagement occurs at or just below the final load, leaving essentially no composite load increment.  
   Fix: Always use the staged result; do not reduce engagement to a Boolean stiffness switch.

7. **Phase 8 still encodes the incorrect Boolean stiffness switch.** It selects either \(I_\text{comp}\) or \(2I_y\), despite S3 now producing staged-slip results.  
   Fix: Make S9 consume the stage-1 and stage-2 deflection components from S3 and report their sum.

8. **Phase 5 retains the wrong rev-9 default.** Item 25(a) says \(L_u\) defaults to one face-shell thickness, while the connector section now defaults to the physical bound \(t_w/2\) because of the mandatory filled annulus.  
   Fix: Change item 25(a) to \(L_u=t_w/2\) by default and retain the face-shell case only as a comparison.

9. **Phase 5 has a broken internal reference.** Item 26 calls 25(e) the governing von-Mises check, but 25(e) defines resultants; the combined check is 25(g).  
   Fix: Change the reference to 25(g).

10. **The plan still says rod combined action is expected to govern.** Phase 5 item 23 retains the rev-8 conclusion, while rev 9 says grout bearing controls connector selection in the worked comparison.  
    Fix: State neutrally that the complete layout enumeration determines whether rod steel, grout bearing, breakout, or another mode governs.

11. **The worked-anchor narrative still says “rod flexure governs.”** That stale paragraph directly contradicts the new headline and companion grout check.  
    Fix: Replace it with the accurate conclusion: the 3/4-inch A307 rod has the larger DCR in the reference configuration, but grout bearing prevents rod-grade-only remedies and can control redesigned configurations.

12. **Spacing is not the only possible grout-bearing remedy.** Because \(f_g=k/d_b\), increasing diameter reduces grout pressure; the table itself shows 1-1/4-inch A307 passing grout at 16 inches.  
    Fix: Say spacing is the most efficient demonstrated remedy, while both spacing and rod diameter are valid design variables; rod grade alone does not improve grout bearing.

13. **Fixture 15 should distinguish those conclusions.** It currently supports “1 inch does not rescue grout” and “8-inch spacing works,” but not the categorical claim that spacing is the sole relief.  
    Fix: Retain those assertions and add the shown 1-1/4-inch passing case to pin diameter scaling.

14. **The unresolved Appendix 6 provisions must remain disabled, not merely flagged.** The plan appropriately recognizes that its prior equation was wrong.  
    Fix: Implement the full-span default first and prohibit \(L_b=s\) or reduced \(KL\) until the exact AISC 360-22 point-brace provisions are verified and tested.

15. **The Phase 0 discrepancy is acceptable only as a hard build gate.** It does not invalidate the mechanics plan, but Fixture A cannot claim 2% reproduction while its reference load remains internally inconsistent.  
    Fix: Complete the stated reconciliation or formally split the fixture before calling reference reproduction complete.

The principal connector correction is now strong: grout bearing is run alongside rod steel, masonry capacities are not improperly halved per plane, the physical-contact default is defensible only with a verified filled detail, and spacing is correctly included in the coupled optimization. The remaining material issue is that the specified epoxy detail does not remove channel-hole clearance, while the deflection calculation treats engagement as retroactively composite.

VERDICT: REVISE
### Claude's response — Round 6 (plan revised to rev 10, then rev 11 after a user decision)

Round 6 ran past the `MAX_ROUNDS=5` cap because the engineer explicitly authorised it so Codex could
see rev 9. **Every finding accepted. Nothing rejected.** Two of them ended the composite scheme as a
design basis.

**THE FINDING THAT ENDED IT**

- **#1, #2, #3 — the mandated detail fixes the wrong interface.** Correct, and it is the second time
  the review has caught me solving the wrong half of the slip problem. Longitudinal shear enters the
  rod through **channel-web hole bearing**; epoxy in the **masonry annulus** does nothing about that
  clearance. Worse, the detail as written allows 1/32" at the web, which at the worked case gives
  `w_slip = 0.151 klf` against `w_w = 0.150 klf` — **no engagement at all**. The `c_h = 0.005"` figure
  rev 8 leaned on was unsupported by the detail rev 8 specified.

- **#4, #5, #6, #7 — deflection was treated as retroactively composite.** Also correct and also
  inconsistent on its own terms: rev 9 kept the stage-1 locked-in *moment* for strength and then threw
  away the stage-1 *deflection*. Staged deflection is now mandatory, pure `I_comp` may never be
  substituted while `w_slip > 0`, and Phase 8's Boolean stiffness switch is replaced by
  `delta = delta_nc(w_slip) + delta_comp(w_w - w_slip)` consuming S3's stage outputs. The error was
  not small — at `c_h = 0.005"` the staged result is **0.506 in against a pure-composite 0.123 in**.

Verified independently before accepting:

| connection at the channel web | `w_slip` | wind delta | DCR vs L/600 |
|---|---|---|---|
| standard 1/16" oversize | 0.302 klf | 2.50" | 4.47 FAIL |
| **reamed 1/32" — the rev-8 mandated detail** | 0.151 klf | 2.50" | **4.47 FAIL** |
| `c_h = 0.005"` (the claimed value) | 0.024 klf | 0.506" | 0.90 |
| welded / positive | 0.005 klf | 0.199" | 0.36 |

And the fact that forced a decision rather than another patch: at `L/600` with full `W`, the reference
case needs `I_y = 63.9 in^4` per channel to work non-compositely. **The largest `I_y` in the entire
72-shape C+MC catalog is MC18x58 at 17.6.** There is no non-composite solution at that target, so the
wind deflection basis and the connector detail were one decision, not two.

**USER DECISION (rev 11): relax wind serviceability to the IBC minimum, `L/240` at `0.42W`
(Table 1604.3 note f), and make NON-COMPOSITE the default design basis.** Gravity keeps `L/600`, where
TMS 4.6 actually mandates it. Composite is retained as computed, reported upside behind a **welded**
connector detail. Consequences, all verified at the reference case:

| check | DCR |
|---|---|
| wind deflection, `0.42W` vs `L/240` | 0.75 |
| wind strength, non-composite F6 | 0.37 |
| H1-1b combined with gravity | 0.73 |
| **rod bending, gravity only** | **0.72** |
| grout bearing, gravity only | 0.17 |

**The reference calc's 3/4" A307 at 16" o.c. is adequate on this basis** — and the durable finding for
everyday jobs is not the composite scheme at all, it is that **rod bending is the tightest connector
item at DCR 0.72 and the reference never checked it.** In non-composite mode `V_x = 0`, so the entire
`k` / `s*` / grout-couple apparatus is inert and the connector reduces to gravity actions.

**ALSO ACCEPTED**

- **#8** Phase 5 item 25(a) still carried the pre-rev-9 face-shell `L_u` default — now `t_w/2`.
- **#9** Item 26 referenced 25(e), which only defines resultants — now 25(g).
- **#10** Item 23 still asserted rod steel governs, contradicting its own grout companion — now
  neutral: rod steel, grout bearing, breakout, crushing and hole bearing compete, and the enumeration
  decides.
- **#11** The worked-anchor narrative still said "rod flexure governs" — replaced with the accurate
  statement that rod steel carries the larger DCR *in that configuration* while grout bearing is what
  rules out a rod-grade-only remedy.
- **#12** My "relief is spacing, not rod grade" overstated it. `f_g = k/d_b`, so **diameter reduces
  grout pressure linearly** — 1-1/4" passes grout at 16". Only *grade* is useless for grout. Corrected.
- **#13** Fixture 15 gains a diameter-scaling assertion pinning the 1-1/4" passing case.
- **#14** Appendix 6 provisions are now **disabled in code**, not merely flagged: full span ships
  first, `L_b = s` and reduced `KL` unlock only after the real 360-22 point-brace equations are read
  and tested.
- **#15** Phase 0 is now a **hard build gate**: Fixture A may not be called "reference reproduction at
  2%" while its reference load is internally inconsistent.

**Status.** Codex's Round 6 verdict was REVISE, and its two blocking findings are now resolved — not
by another patch to the composite model, but by a user decision that removes the dependency on it.
The plan is at **rev 11**. Remaining open items, both flagged and neither a mechanics problem: the
AISC Appendix 6 equation numbers (disabled until read from the spec), and the Tedds 2.5% load
reconciliation (a hard gate on Fixture A).

---

## Round 7 — Codex (user-authorised)

The noncomposite design basis is fundamentally sound and is a much safer default. The reported reference-case checks are mutually plausible: weak-axis wind strength, biaxial H1 interaction, gravity-only rod bending, and gravity masonry bearing now form a coherent default load path.

The plan is not yet internally consistent enough to implement, however. Large portions still prescribe the former composite default, and the optional welded composite mode lacks an actual connection design.

1. **The Goal still says the channels act as a composite pair.** That directly contradicts Decision 14’s noncomposite default.  
   Fix: State that the channels act independently by default and that composite action is an optional separately qualified mode.

2. **Load Path items 6 and 7 still present composite action as the primary wind path.** The default path should instead end with independent weak-axis channel bending and \(q=N_{ch}=V_x=0\).  
   Fix: Write separate “Default noncomposite” and “Optional welded composite” wind load paths.

3. **The default noncomposite branch is not explicit in Phase 4.** Phase 4 always calculates composite decomposition and shear flow without a mode gate.  
   Fix: Define the default outputs as \(N_{ch}=q=V_x=M_\text{wind,rod}=k=0\), with each channel receiving its adverse share of weak-axis wind moment.

4. **Phase 3 remains organized around composite tension and compression channels.** E3, E4, D2, and the compression/tension H1 roles arise from the composite axial couple and do not apply to the ordinary noncomposite branch in that form.  
   Fix: Add a primary noncomposite interaction branch using gravity strong-axis moment, allocated weak-axis wind moment, shear, and torsion with zero composite axial force; move wind-couple axial checks behind the optional-mode gate.

5. **Phase 5 still calculates longitudinal shear flow unconditionally.** Its demand list says \(V_x=qs/\text{rows}\) without stating that both are identically zero in the default mode.  
   Fix: Put all \(q\), \(V_x\), antisymmetric grout bearing, and wind-plane rod-bending calculations inside an explicit `compositeMode` branch.

6. **Phase 8 still uses the superseded serviceability basis.** It specifies staged deflection against \(L/600\) using full strength-level wind, contradicting Decision 11’s \(L/240\) at \(0.42W\).  
   Fix: Make the shipping check noncomposite deflection under \(0.42W\) versus \(L/240\); retain staged composite deflection only as an optional-mode result under the same service load basis.

7. **The optional welded mode has no weld design.** No AISC J2 weld strength, weld geometry, channel-web local check, rod/plate check, eccentricity, or load combination is defined.  
   Fix: Either fully design the welded connector and shear plate or make composite output informational only and ineligible to pass or optimize a design.

8. **Welding a rod directly to the channel is not generically valid.** A307 supplies no welding qualification, and A449/A193-B7 rods may require material-specific welding procedures or may be unsuitable for field welding.  
   Fix: Prefer a defined weldable shear-plate detail using specified plate and weld metals; prohibit direct rod welding unless weldability and an approved procedure are supplied.

9. **A positive welded connection should have no clearance-engagement stage.** If the weld transfers longitudinal shear immediately, \(w_\text{slip}=0\); assigning an approximate clearance such as 0.001 inch and requiring a staged gap check is physically inconsistent.  
   Fix: Use a zero-gap elastic connector model for a qualified weld, reserving staged clearance analysis for bearing-type connectors.

10. **The optional shear plate is named but not described.** Its geometry, attachment to both channels, transfer through the wall, interaction with the rod, and grout bearing path are absent.  
    Fix: Provide one buildable standard detail and derive its complete force path before enabling composite design.

11. **Optional composite action is therefore not adequately quarantined.** Decision 14 describes it as “available,” and auto-design can apparently use it, even though its governing connection has not been designed.  
    Fix: Ship composite mode as read-only informational output with no PASS status and exclude it from auto-design until the welded detail and AISC checks are complete.

12. **The worked-anchor section still contains obsolete composite conclusions.** After correctly presenting the noncomposite baseline, it retains “rod flexure governs … the 3/4-inch rod does not work,” which applies only to the rejected composite configuration.  
    Fix: Clearly label the old table “optional composite case” and remove any unqualified statement that the reference rod fails.

13. **The Key Decisions section still says \(L/600\) at full wind was accepted.** That directly contradicts the new \(L/240\) at \(0.42W\) decision.  
    Fix: Replace the stale bullet with the rev-11 IBC serviceability basis and its applicability assumptions.

14. **Risk 3 retains the obsolete face-shell \(L_u\) default.** Elsewhere the composite default is the physical \(t_w/2\) bound, while the noncomposite mode does not use the antisymmetric \(k\)-field at all.  
    Fix: State separate mode-specific contact assumptions and remove the superseded universal default.

15. **The default gravity rod-bending contact assumption needs to be stated independently.** Composite annulus assumptions no longer establish the gravity-only rod contact length in the base design.  
    Fix: Define the base grouted-annulus contact length used in \(M_\text{grav}\), require a sensitivity check, and tie it to the ordinary installation specification.

16. **The noncomposite wind allocation needs a governing design rule, not only a diagnostic sweep.** A 50/50 result cannot be called the design case if 60/40 or 100/0 produces a larger DCR.  
    Fix: Make the selected engineer-defined split govern and require the auto-designer to envelope the prescribed adverse split rather than merely report it.

17. **The claimed IBC minimum needs applicability echoed in the output.** \(L/240\) is appropriate for exterior walls with brittle finishes, and note (f) supplies the reduced wind basis; users must not assume it is universally the controlling project criterion.  
    Fix: Print the selected finish category, table row, note-(f) basis, and a warning that project-specific criteria may be stricter.

18. **The verification suite remains composite-heavy.** Assertions 1–3, 8, 10–11, and much of Fixture B validate optional composite mechanics but do not establish that the shipping branch zeros all composite demands.  
    Fix: Add a default-mode regression asserting \(q=N_{ch}=V_x=k=M_\text{wind,rod}=0\), full noncomposite strength interaction, \(0.42W\) deflection versus \(L/240\), and gravity-only connector demands.

19. **The reference baseline should be its own pinned fixture.** The stated DCRs—0.75 deflection, 0.37 wind flexure, 0.73 interaction, 0.72 rod bending, and 0.17 grout bearing—are now the key shipping behavior.  
    Fix: Add a machine-checkable noncomposite reference fixture reproducing all five values and identifying the exact load combination and sharing assumption.

20. **The unresolved Appendix 6 issue is safely contained only if reductions remain disabled.** The plan now says this, which is acceptable.  
    Fix: Keep full-span \(L_b\) and \(KL\) hard-coded for the first release; do not expose an engineer override that bypasses the disabled verification.

21. **The Tedds discrepancy is also acceptably contained as a hard Phase 0 gate.** It need not block the mechanics plan if the fixture is formally split as stated.  
    Fix: Preserve that gate and prohibit the UI or documentation from claiming 2% reproduction until it closes.

The new default answer is defensible: two independent channels, full-span stability assumptions, adverse wind sharing, complete biaxial channel interaction, gravity rod flexure, gravity masonry checks, and IBC-minimum wind serviceability. The remaining material problem is document and implementation branching: composite-era equations still occupy the unconditional phases, while the optional welded mode is presented as design-capable without any weld or shear-plate design.

VERDICT: REVISE
### Claude's response — Round 7 (plan revised to rev 12)

**Every finding accepted. Nothing rejected.** Codex opened by validating the new basis — *"the
noncomposite design basis is fundamentally sound and is a much safer default … the reported
reference-case checks are mutually plausible"* — and then found that essentially all 21 remaining
problems are one problem: **rev 11 changed the decisions and left composite-era equations sitting in
the unconditional phases.** That is the same failure mode caught in rounds 3, 5 and 6, and patching it
a fourth time would not have stopped it recurring.

**The structural fix: an explicit mode gate.**

A new **§Two modes** section now sits ahead of everything and states the branch in code terms:

```
compositeMode = FALSE     <-- DEFAULT, and the only mode that can produce a PASS
    q = V_x = N_ch = k = M_wind,rod = 0   identically, asserted in Fixture C 15a
compositeMode = TRUE      <-- INFORMATIONAL ONLY. Cannot pass. Cannot optimise.
```

Every affected section is now branched rather than reworded: the **Goal** says the channels act
independently by default; **Load Path** items 6 and 7 are split into a default non-composite path and
an optional composite path; **Phase 3b** gains a primary non-composite interaction branch
(`P_r = 0`, so H1-1b reduces to `M_rx/M_cx + M_ry/M_cy`, anchored at 0.73) with the E3/E4 and D2
checks — which exist only because of the composite couple — moved behind the gate; **Phase 4** gains
a default branch that returns zeros; **Phase 5** marks every longitudinal term as composite-only.

**Composite mode ships read-only (#7-#11).** Accepted in full, and the reasoning is not soluble by
more analysis here:
- there is **no weld design** — no AISC J2 strength, geometry, web local check, or eccentricity;
- **welding the rod is not generically valid** — A307 carries no weldability requirement, A449 is
  quenched-and-tempered and A193-B7 is alloy; a weldable **shear-plate** detail with specified plate
  and weld metal is the right answer and has not been designed;
- **a qualified weld has no clearance stage**, so `w_slip = 0` and rev 11's `c_h ~ 0.001"` for a weld
  was physically inconsistent — staged clearance analysis is for bearing-type connectors only;
- **the shear plate is named but not described.**

So composite mode produces numbers and no verdict: **no PASS status, excluded from the auto-designer**,
marked as requiring a separately engineered connection. Enabling it for design is future work with its
own review, not a checkbox.

**Also accepted**

- **#6** Phase 8 still specified staged deflection against `L/600` at full `W`, contradicting Decision
  11. The shipping check is now `0.42W` vs `L/240` on non-composite `2*Iy` (anchor 1.050 vs 1.400 in,
  DCR 0.75), with the staged composite result retained as informational at the same service basis.
- **#12** The worked-anchor section still carried "rod flexure governs … the 3/4" rod does not work,"
  which is true only of the rejected composite configuration. Relabelled **optional composite case
  only**, and the unqualified failure claim removed — on the shipping basis that same rod is adequate.
  What survives is narrower and more useful: the reference calc **never checked rod bending**, and on
  its own basis it comes out at DCR 0.72.
- **#13** Key Decisions still said `L/600` at full wind was accepted — replaced with the rev-11 IBC
  basis and *why* it was chosen (no non-composite solution exists at the stricter target).
- **#14, #15** `L_u` is now stated mode-specifically, and the **gravity bearing length for `M_grav` is
  defined independently** from the ordinary installation specification rather than inherited from
  composite annulus assumptions.
- **#16** The non-composite wind split now **governs** — the engineer's selected ratio drives the unity
  checks and the auto-designer envelopes the prescribed adverse split; the 50/50 / 60/40 / 100/0 sweep
  is retained as evidence, not as the design basis.
- **#17** The sheet must print the finish category, the Table 1604.3 row, the note-(f) basis, and a
  warning that project criteria may be stricter — `L/240` is a minimum, not a universal criterion.
- **#18, #19** The verification suite was composite-heavy and did not establish that the shipping
  branch zeros composite demands. Added **Fixture 15a**, a default-mode zero assertion (the most
  important fixture in the suite, because it guards the branch that actually ships), and **15b**, a
  pinned non-composite reference fixture reproducing all five DCRs — 0.75, 0.37, 0.73, 0.72, 0.17 —
  with the load combination and sharing assumption named.
- **#20** No engineer-facing override may bypass the disabled Appendix 6 reduction — it is **absent
  from the UI in release 1**, not merely defaulted off.
- **#21** Neither UI nor documentation may claim 2% reference reproduction until the Phase 0 gate
  closes.

**Status.** Rev 12. Codex's Round 7 verdict was REVISE, and its substance was branching discipline
rather than mechanics — it explicitly endorsed the default load path as *"two independent channels,
full-span stability assumptions, adverse wind sharing, complete biaxial channel interaction, gravity
rod flexure, gravity masonry checks, and IBC-minimum wind serviceability."* The two open items are
unchanged and both contained by design: the AISC Appendix 6 equation numbers (reduction hard-disabled)
and the Tedds 2.5% reconciliation (hard Phase 0 gate).

---

## Cross-check round 1 — independent review per HANDOFF-CHANNEL-LINTEL-CROSSCHECK.md (2026-08-19)

Five independent reviewers: (1) fixtures on a clean run, (2) TMS citation verification against
`tms_full.txt`, (3) independent numerical re-derivation of the reference case, (4) adversarial attack
on the ten §4 judgment calls, (5) Codex `exec -s read-only` adversarial pass. A final arbiter (Fable)
resolved disagreements. No repo files were modified by any reviewer.

**Fixtures:** 61 passed, 0 failed on a clean run.

**Codex verdict: REVISE.**

### Confirmed defects (arbiter agrees; found independently by 2+ reviewers)

- **C1 — SEAL-BLOCKING: no load-combination envelope.** `run()` scores each of the 10 combos with the
  heuristic `M/1000 + 10·|w_w|` (engine:230–231) and evaluates EVERY check at the single winner. With
  any nonzero wind, `1.2D+W` beats `1.4D`, so 1.4D — which governs gravity — is never applied to any
  strength check. Found independently by Codex and the numerical reviewer; confirmed by the arbiter in
  source. True per-check envelope on the reference case: gravity F2 0.350→0.408, shear 0.064→0.075,
  rod von Mises 0.783→0.906, grout bearing 0.185→0.216, jamb group (5 bolts) 0.860→**1.003 FAIL**.
  The §2 handoff PASS holds only on the engine's single-combo basis. The fixture-A note "1.4D governs"
  is true only in the p=0 run it was printed from. **Fix:** evaluate every check under every applicable
  combination and retain the per-check maximum DCR. Fixture: assert each reported DCR equals its
  combination maximum.
- **C2 — SEAL-BLOCKING: jamb bolt-group eccentricity.** `Vj = R/n` (engine:590–603) ignores
  `e_group`. Elastic-vector method on the actual line layout (8" pitch, first bolt 4" past the opening
  edge, reaction in the web plane): extreme-bolt demand ×3.40 (n=4) / ×3.50 (n=5) vs R/n — on a check
  already at DCR 1.075 (n=4) / 0.860 (n=5) before enveloping, and 1.003 (n=5) after C1. `optimise()`
  actively sizes `jamb_n` on the understrength model (engine:666–681). Disclosure inside a green
  passing row is not sufficient for a sealed calc. **Fix (minimum):** compute
  `R/n + R·e_group·x_max/Σx²` from existing layout inputs (~10 lines), or demote the jamb row to
  `info()` and remove jamb sizing from `optimise()` until Phase 7.
- **C3 — must-fix (one line): hardcoded `Cb = 1.14`** (engine:303) is the full-span UDL value; for an
  engineer-specified intermediate `L_b`, interior segments approach uniform moment (Cb ≈ 1.0).
  Counterexample MC18X42.7, L_b = 120" (inside Lp–Lr): 14.0% unconservative, not Mp-capped. Reference
  fixture (L_b = 16" < Lp, plastic branch) unaffected. **Fix:** `Cb = (LbUser && Lb < L_in) ? 1.0 : 1.14`.
- **C4 — must-fix (one line + fixture): engine can return `pass:true` in composite mode.**
  engine:637 computes the top-level `pass` with no `compositeMode` gate; only the composite
  grout-bearing row is `info()` (engine:567), so the UI's suppression (html:414–422) is the only
  quarantine layer, and the results table still renders green PASS badges per row (html:469–471).
  Counterexample was actually run: `{compositeMode:true, p_psf:5, s_in:8, d_b:1.25, jamb_n:12}` →
  `pass: true` while `mode` says "cannot pass". `optimise()` itself is clean (`base.compositeMode =
  false`, engine:664, unconditional). **Fix:** `pass: !compositeMode && ...`, force
  `informational = true` on every check when composite, add a fixture asserting `r.pass !== true`.
- **C5 — latent: TMS 5.1.1.1 dispersion terminations missing.** `bearing + 2h/3` (engine:221) omits
  the half-wall-height termination (up to 2× the permitted dispersion length, unconservative), the
  movement-joint/end/opening truncations, the independent per-side termination, and the
  centre-to-centre cap; the 2V:1H branch is never implemented. Currently dead code — `pointLoads` is
  `[]` in both UI and fixtures. **Fix:** implement the terminations before exposing point loads, or
  drop the citation until then.
- **C6 — latent (one line): fu cap missing on Eq. 9-7.** engine:493 uses raw `Fu_rod`; TMS 9.1.6.3.2
  applies `fu ≤ min(1.9fy, 125 ksi)` to the shear equations too. Inert for the three built-in grades;
  bites for a user-entered low custom `rodFy`. **Fix:** mirror the cap from engine:495.

### Disclosure fixes (from the UI/docs sweep; no wrong numbers)

- **D1:** the Tedds under-check (ran only `1.2D+1.6SL`; `1.4D` governs) is documented in docs/,
  fixtures, and the handoff but has zero hits in the UI. Add one bullet to the assumptions block
  (html:494–503).
- **D2:** 17 engine AISC clause/equation citations plus the `AISC 360-22 LRFD` header badge render as
  unqualified fact although AISC 360-22 text was never available; only App. 6 carries the "not
  verified" hedge. Add one caveat bullet in the same block.
- **D3 (minor):** hand-check §6 "Shipping basis" table is computed at `L_b = 16"`, not the shipped
  full-span default — relabel. State `jamb_n = 5` wherever the reference PASS is quoted (fixture
  default is `jamb_n: 4`, which is what 15b's printed 1.075 refers to). Annotate the stale App. 6
  citation at review-log:551–554 as superseded, and the stale "at 2%" plan headings.

### TMS citation audit

10 of 11 VERIFIED verbatim against `tms_full.txt` (4.4.4; 4.6 incl. clear-span and service-D+L basis;
9.1.4.1(d); 9.1.4.2; Eq. 9-2 with both fu caps; Eq. 9-4/9-5/9-7 incl. Apv = π·lbe²/2; Eq. 9-8 with 5/3
exponents; 9.1.8; 9.3 as a non-contradicted simplification). The load-bearing claim "Eq. 9-5 crushing
is flat in wall thickness" was CONFIRMED by cross-checking radical placement against the SI-unit table
(1750 US ↔ 5360 SI, arithmetic shown in the reviewer transcript). One MISMATCH: 5.1.1.1 (item C5
above). Two wording notes: "mandated" overstates §4.6 where the supported masonry is reinforced
(per §5.3.1.6.2 commentary it is conservative-but-optional there); TMS 9.3.3.2.2.1's Mn ≥ 1.3·Mcr
floor is uncited and unchecked — likely governs the bond-beam steel at these tiny As_req values,
though the 9.3.3.2.2.2 one-third-excess exemption plausibly covers the 0.40 in² default; check or
state it.

### Numerical re-derivation

All 8 reference DCRs reproduced to 0.00% by independent hand statics from freshly-typed AISC v16
properties (on the engine's single-combo basis — see C1 for the envelope values). Key intermediates
confirmed: w_D pair 1.2054 klf (full-rectangle wall load, no arching credit — conservative), P_rod
0.9643 k, M_grav 1.0276 k-in, dF 0.0959 k, e = e_o + t_w/2 = 1.194 in re-derived from the thin-wall
formula (e_cl = 26.017/21.788 = 1.1941). The 15b/handoff "1.075 vs PASS" discrepancy resolved: 15b
uses the fixture default `jamb_n: 4`; the handoff case is 5 bolts.

### Ten judgment calls — verdicts after arbitration

1. **e_o datum — ENDORSED, closed.** All 72 shapes re-derived; worst 0.644% at MC13X40; the
   web-centreline hypothesis fails at 11%+. Codex also endorsed.
2. **V_mas split — ENDORSED** for the shipping branch (P_rod once on masonry, halved per steel plane;
   no double-count). Composite-branch `V_x·n_rows` is a crude stand-in (5.6% low at rows=2, 89% high
   at rows=4) — acceptable only because quarantined; note it in the code.
3. **Eq. 9-1/9-6 omission — omission ENDORSED, justification REJECTED as written.** Arbiter's ruling:
   the "strictly conservative" argument (advanced by one reviewer) is a sign error — dropping a member
   of a capacity `min()` can only RAISE the result, so the omission is unconservative in general, and
   "A_pt not constructible" invites the objection "then how do you know it does not govern?" What
   holds is mechanism-absence under thru-clamping: rod tension is reacted by the far washer/channel
   bearing the far face in compression (that mode IS the face-shell term already in the min), and
   pryout would have to rotate a prism out of a face restrained by the far washer/channel. Rewrite
   engine:538 to state mechanism-absence, citing §6.3.2/6.3.3 (which mandate the open-cell/overlap
   deductions the author's argument gestures at). Codex's demand to make the check FAIL/indeterminate
   is rejected on that mechanism basis — flagged for Nick to confirm, alongside Codex's broader
   (correct) observation that TMS 9.1.6.3's calculated-strength route formally covers headed/bent-bar
   anchors and a thru-rod rides on it by disclosed analogy (UI:496 already says so).
4. **Rod bending FBD — ENDORSED, closed.** Closed form matches the patch-load derivation exactly at
   four L_c values; span t + t_w is web-centreline to web-centreline; reactions at web mid-thickness
   slightly conservative.
5. **trib_rod vs pitch — ENDORSED, closed.** Every use audited; no conflation; fixtures pin the
   invariants.
6. **L_b as engineer input — judgment ENDORSED** (conservative full-span default that FAILs the
   reference at DCR 1.092; warning names what is not verified; auto-App.6 would require brace
   stiffness the calculator cannot know). Codex's demand to block PASS on any reduced L_b is rejected
   as overreach — an engineer-owned, warned bracing statement is standard practice. But see C3 (Cb),
   found while attacking this item.
7. **Sharing ratio — default ENDORSED, propagation CHALLENGED.** 50/50 gravity is forced by statics
   (centered grout patch on a determinate two-support rod), not mere judgment — say so in the UI. But
   100/0 doubles channel demands while leaving per-plane rod shear and jamb demand unchanged; if the
   engineer's reason for 100/0 is one-sided load entry, connector and jamb should scale too. Fix or
   disclose explicitly.
8. **Composite quarantine — UI and optimiser VERIFIED, engine CHALLENGED** → C4.
9. **Bond beam — ENDORSED at shipping margins** (As_req 0.0028 in² vs 0.40 provided; worst
   configurable DCR 0.254). Edges flagged: L²/10 is 11% under for the exactly-2-span in-line case
   (already warned); 0.9d unconservative only above As ≈ 0.22 in²; `d_bb = t − 2` is a wall-thickness
   stand-in that is conservative only because the plan mandates the multi-course band — add a code
   comment; and the 1.3·Mcr floor (TMS note above).
10. **Jamb e_group — CHALLENGED, SEAL-BLOCKING** → C2. The plan predicted this check "commonly
    governs"; the reaction-unbalance provision (plan item 32) is also unimplemented.

### Open items (§5 of the handoff)

Both CONFIRMED still open and properly disclosed. No "2% reproduction" claim anywhere in UI or docs
(the only UI hit is the explicit disclaimer at html:502); Phase 0 gate language intact
(hand-check:192–196). No automatic App. 6 reduction exists in any code path; the bad
`0.01·M_r·C_d/h_o → A-6-7` claim survives only inside explicit rejections. Registry still `wip`
(calcs.ts:421–429).

### Verdict

**REVISE — do not seal.** The §2 reference arithmetic is clean to 0.00% and 10/11 TMS citations are
verbatim-verified, but C1 (no combination envelope) and C2 (jamb e_group) together move the reference
case's governing check from "gravity deflection 0.926 PASS" to a jamb-group FAIL, and C3/C4 falsify
stated invariants cheaply. Required before `ready`: C1, C2, C3, C4; D1, D2; re-run and re-pin
fixtures (the pinned DCRs 0.350/0.064/0.716/0.783/0.185 all change under enveloping). Recommended in
the same pass: C5 guard or citation removal, C6, item-3 justification rewrite, item-7 propagation
disclosure, D3. Codex REVISE verdict: accepted in substance; its findings 3/5 (reject the TMS anchor
analogy outright, block PASS on reduced L_b) are rejected per items 3 and 6 above — logged here with
reasons per the handoff's arbitration rule.

---

## Cross-check round 1 — fixes applied (2026-08-19)

All required and recommended items from the round-1 verdict were implemented the same day, per Nick's
instruction, by subagents with the arbiter as final reviewer. Fixture suite grew 61 → **128 passed,
0 failed**, with every pinned value hand-derived (tolerances tightened from 6–15% to 0.1–0.2%).

**Engine** (`masonry_opening_channel_lintel_engine.js`): C1 full per-check combination envelope
(`demandsFor`/`govFor`; every check row carries its governing combo; per-combo consistency incl.
H1-1b pairing; service checks unchanged); C2 elastic-vector jamb group (new inputs `jamb_pitch_in`
def. 8, `jamb_edge_in` def. 4; extreme bolt = R/n + R·x̄·|x_max−x̄|/Σd²; both R/n and extreme shown);
C3 Cb = 1.0 for engineer-specified L_b below full span; C4 composite mode returns `pass: null` with
every row informational; C5 dispersion half-height termination + c/c cap + runtime warning; C6 fu cap
mirrored into Eq. 9-7 (and hoisted for Eq. 9-2); Eq. 9-1/9-6 justification rewritten on
mechanism-absence citing §6.3.2/6.3.3; stand-in comments added (composite V_mas, d_bb, 1.3·Mcr,
sharing statics).

**UI/docs**: D1 Tedds-under-check bullet and D2 AISC-unverified bullet added to the assumptions
block; jamb layout inputs wired; sharing hint rewritten (statics-forced 50/50, channel-only 100/0
envelope); e_group bullets in UI and hand-check updated to describe the implemented model (face
unbalance, plan item 32, still not modelled); hand-check §6 relabelled (L_b = 16" assumed,
jamb_n = 5) with a dated caveat note; stale A-6-7/A-6-12 rev-history entry and three "at 2%" plan
lines annotated in place.

**Fixtures**: two stale pins corrected (rod vM 0.906, grout bearing 0.216) and 15b fully re-pinned
post-envelope; new suites — C18 envelope (F2 governed by 1.4D, F6 by the wind combo, labels differ),
C19 jamb elastic vector (closed form k = 1/n + 6a/(p·n(n+1)) + 3(n−1)/(n(n+1)) pinned against 8
layouts, including the counter-intuitive facts that k depends on edge/pitch only through their ratio
and that halving pitch alone RAISES k), C20 composite gate (`pass === null`, all rows informational;
re-runs the original counterexample), C21 Cb branch (φMn = 1918.6 k-in at L_b = 120" — the stale 1.14
branch over-credited 14.0%), C22 fu cap (φBvns = 3.274 k at rodFy = 10, governs below crushing).

**Post-fix reference case** (MC18X42.7, L=28 ft, s=16 stag., ¾" A307, f'm 1900, L_b=16", 50/50):
F2 0.408 (1.4D) · shear 0.075 · F6 0.367 (1.2D+W) · H1-1b 0.716 · rod vM 0.906 (1.4D) · grout
bearing 0.216 · gravity defl. 0.926 · wind defl. 0.750 · **jamb group 3.511 (n=5) / 4.264 (n=4),
1.4D — FAIL, governing**. Verdict: **FAIL**. `optimise()` finds zero passing candidates on the
reference input (best: C15X40, s=24, jamb_n=12, DCR 1.569, jamb-governed) — the jamb group is the
binding constraint everywhere, as the plan predicted ("commonly governs").

Note: the round-1 C1 line predicting "jamb (5 bolts) 0.860→1.003 FAIL" was C1 alone on the old R/n
model; with C2 also applied the composed values are 3.511 (n=5) / 4.264 (n=4) = envelope × the
3.4–3.5 eccentricity amplification. Superseded, not wrong.

**Open engineering question for Nick before this calc can ever reach `ready`:** under the honest
jamb model, bolt shear alone cannot deliver the reference reaction into the pier — per-bolt capacity
is crushed by Eq. 9-5 (4.71 k for ¾" rod at f'm 1900) against a 16.5 k extreme-bolt demand. Either
the connection concept changes (bearing seat / corbel / more-larger bolts at wider pitch with the
group moment addressed), or the jamb load path is redesigned. The elastic-vector model itself (
reaction at the opening face) is conservative; Nick may also judge a portion of R transfers by direct
bearing where the channel laps the pier. Status remains `wip`.
