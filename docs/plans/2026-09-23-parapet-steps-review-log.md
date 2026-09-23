# Plan Review Log: parapet steps + nomenclature
Started 2026-09-23. MAX_ROUNDS=5. Plan: docs/plans/2026-09-23-parapet-steps-plan.md

## Round 1 — Codex (gpt-6-astra)

The [plan](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/docs/plans/2026-09-23-parapet-steps-plan.md>) needs revision. The main blockers are equilibrium, load-case envelopes, and handoff correctness—not the principal fixture arithmetic. No files were modified.

I independently calculated the fixtures. Forces are kips, moments kip-ft, and locations feet from W:

| Fixture | Reactions, W → E | Continuous shear-zero locations | \(M_{\max}\) | \(V_{\max}\) | Diaphragm shear | Chord force |
|---|---|---|---:|---:|---:|---:|
| (a) | 16.80 / 15.90 | 28.582677 | 252.637795 | 16.80 | 140.0 plf | 2.105315 |
| (b) | 8.40 / 16.80 / 7.50 | 15.354331, 45.000000 | 68.102362 | 9.30 | 77.5 plf | 0.567520 |
| (c) | 7.725 / 17.250 / 7.725 | 15.450000, 44.550000 | 59.675625 | 8.625 | 71.875 plf | 0.497297 |

For (b), the second-span maximum is 56.25 kip-ft. For (c), both spans reach 59.675625; **59.67 should round to 59.68**.

Fixture (e) checks out using the repository’s tabulated \(K_z=0.76\): \(q_p=21.521040384\), \(p_\text{step}=32.281560576\), \(w_\text{typ}=161.40780288\), and parapet forces **58,106.809 / 19,368.936 lb**. Retain that precision internally.

1. **Blocking: the 3+ line overhang model violates moment equilibrium.**  
   Plan line 39 explicitly permits this failure. With \(L=60\), \(w=0.5\), and walls at 10/30/60, its baseline reactions are 10/12.5/7.5: reaction moments total **925**, while load moments total **900 kip-ft**. Reporting separate spans cannot supply the missing external couple. An end span that correctly includes the left overhang gives assembled reactions **11.25/11.25/7.5**. Equal overhangs can conceal the defect through cancellation.  
   **Fix:** Include overhang moments in adjoining-span reactions and moment diagrams, or reject those layouts; require global equilibrium for every accepted model.

2. **Blocking: assigning \(GC_{pn}=1.5\) to every step is not a conservative response envelope.**  
   ASCE assigns +1.5 to the windward parapet and −1.0 to the leeward parapet; each coefficient already represents pressure across that individual parapet. The 2.5 combination applies to an opposing pair. [ASCE 7-16 §27.3.4 text](https://www.sweetstudy.com/files/asce7-16_excerpts-3571557.pdf)  
   Counterexample: \(L=60\), supports 10/50, baseline \(w=0.5\), \(q_p=30\), and opposite-face steps over [0,10] and [50,60], each \(\Delta h=6\). Applying 1.5 to both gives **\(M_{\max}=61.500\), \(V_{\max}=10.000\)**. The actual 1.5/1.0 assignment gives **\(M_{\max}=63.762656\), \(V_{\max}=10.1125\)**. Larger pressures reduce some effects where influence signs oppose.  
   **Fix:** Analyze both physical wind senses with the appropriate face coefficients, then envelope signed reactions, shear, and moment while preserving their load-case identity.

3. **High: the claimed maximum \(q_p\) is not enforced.**  
   The proposed diaphragm input lacks `hp_max_ft` or a pressure-height limit, so a step taller than the MWFRS maximum can use insufficient pressure. Also, the page defines `h` as mean/eave roof height; `h + hp_max` need not equal the highest actual parapet elevation on a sloping roof. ASCE requires pressure evaluated at the parapet top. [§27.3.4](https://www.sweetstudy.com/files/asce7-16_excerpts-3571557.pdf)  
   **Fix:** Carry and validate the governing absolute parapet-top elevation and maximum step height; reject inconsistent geometry or recompute pressure.

4. **High: the ASD instruction can apply the wind factor twice.**  
   Plan line 78 says “÷0.6 rule for step force” while also declaring `p_step` strength-level. Existing [handoff conversion](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/lateral-handoff.js:229>) already converts entered baseline forces before analysis. For fixture (a), ASD baseline 18 plus ASD step 1.62 must display **19.62 k** and export **32.70 k**. Dividing the strength step 2.7 by 0.6 exports **34.50 k** instead.  
   **Fix:** Specify one canonical load basis: scale strength steps by 0.6 for ASD display, and add unscaled strength steps to the converted baseline during export.

5. **High: `assemble()` discards the proposed step contract.**  
   [Assembly](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/lateral-handoff.js:383>) reconstructs levels from an explicit field list. Neither `F_parapet_step_*` nor level `parapet` survives; its geometry reconstruction also omits `hp_typ_ft`. WP-4 does not specify updating this function. I confirmed the field loss with an in-memory assembly probe.  
   **Fix:** Extend assembly explicitly and test field preservation through snapshot → level → assembled record → downstream import.

6. **High: the shared reaction-sign flag becomes invalid with steps.**  
   [wallsFor](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/lateral-handoff.js:197>) sets one `sign=-1` if either wind or seismic reaction is negative; the shearwall page applies it to both. With walls at 20/29, baseline wind and seismic each 30 k, and a 2.7-k wind step centered at 10, the first wall has **wind +2.366667, seismic −3.333333**. The flag incorrectly makes its wind contribution negative.  
   **Fix:** Carry separate wind/seismic signs—or signed reactions—through the contract and downstream sum checks.

7. **High: fill-blank pressure/height imports silently retain obsolete engineering inputs.**  
   Reimporting a revised MWFRS record replaces baseline forces but leaves populated `#ppStep` and `#hpTyp` untouched. Changing typical height locally similarly changes the incremental step calculation without changing the typical load already embedded in `V`. Subtracting the computed step from the total makes the proposed cross-check pass despite this inconsistency.  
   **Fix:** Refresh source-owned parapet inputs on import and validate explicit overrides against the baseline’s stored pressure and typical height.

8. **Medium: the saved-file migration covers only one loading path.**  
   The proposed MWFRS shim handles `AREv2.loadFromState`, but [applyInputsMWFRS](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/asce716_mwfrs_calculator.html:1784>) skips absent JSON properties. Loading an old JSON file after entering `hpTyp=2` therefore retains 2 instead of restoring blank=max. Dynamic step-row inputs also require `data-are-ignore`; otherwise [ARE persistence](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/are-utils-v2.js:902>) captures them alongside `#stepJSON`, recreating row-count mismatch problems.  
   **Fix:** Define defaults for both snapshot and legacy JSON loaders, make `#stepJSON` authoritative, and test old-file loading into an already populated stepped model.

9. **Medium: direction mapping is correct, but the chord labels remain physically reversed.**  
   N/S faces → Wind-Y with west-origin coordinates; E/W faces → Wind-X with south-origin coordinates agrees with the engine and SW-origin diagram. However, [renderDir](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/rectangular_diaphragm_calculator.html:730>) assigns Wind-X chords to N/S edges and Wind-Y chords to E/W edges. These strings are absent from the replacement list.  
   **Fix:** Label Wind-X chords as NS-running members at E/W edges and Wind-Y chords as EW-running members at N/S edges; label step coordinates explicitly `x from W` or `y from S`.

10. **High: stepped loading has no valid single-line design model.**  
    The current engine allows one wall and reports \(VL/8\) only as a reference. An eccentric step introduces a moment that one translational reaction cannot balance, yet WP-1 defines new moment analysis only for two or more lines.  
    **Fix:** Reject single-line stepped designs unless rotational restraint and its force-transfer model are explicitly supplied.

11. **Medium: the acceptance tests contain incompatible requirements and a mixed fixture.**  
    Bitwise preservation across arbitrary zero-step layouts would preserve the defective overhang model. Fixture (f) also combines fixture (a)’s **45 psf** reactions with an imported pressure of **32.28 psf**; the latter produces **1,936.8 lb**, not 2,700 lb, for that step.  
    **Fix:** Preserve legacy goldens only for valid unchanged cases, add deterministic overhang/mixed-sign/ASD tests, and separate the 45-psf round trip from the Red Bluff import fixture.

The existing `node tools/test-lateral-handoff.mjs` suite passes. It does not exercise these new failure cases.

VERDICT: REVISE
### Claude response to round 1
Accepted all 11 points (R1–R11 appended to plan). R1 and R9 are pre-existing defects — fixing them changes results for 3+ line layouts with overhangs and the chord labels; flagged for Nick.

## Round 2 — Codex

Revision 1 fixes the overhang and ASD calculations, but **the revised envelope check is mathematically invalid**, and the envelope handoff still needs a precise contract. No files were modified.

Verified numerically:

| Revised fixture | Independent result |
|---|---|
| R1: walls at 10/30/60 | Reactions **11.25 / 11.25 / 7.50 k**; ΣR = **30 k**; ΣRx = **900 kip-ft** |
| R1: shear/moment | Shear zeros at **22.5 and 45 ft**; support moment **−25 kip-ft** at 10; global \(M_{\max}\) **56.25 kip-ft** at 45; \(V_{\max}\) **7.50 k** |
| R4: ASD | **19.62 k** total, reactions **10.08 / 9.54 k**; strength export **32.70 k**, reactions **16.80 / 15.90 k** |
| R2/R11: opposite-face steps, wind from N | Reactions **17.8125 / 16.6875 k**; total **34.50 k**; shear zero **30.225 ft** |
| Same, wind from S | Reactions **16.6875 / 17.8125 k**; total **34.50 k**; shear zero **29.775 ft** |

Both opposite-face cases give \(M_{\max}=\mathbf{63.76265625}\) kip-ft and \(V_{\max}=\mathbf{10.1125}\) k. Their wall envelopes are **17.8125 / 17.8125 k**, summing to **35.625 k**. Fixtures (a)–(c) retain their previously verified governing values.

Remaining flaws:

1. **Blocking — R2’s signed Σ≥ check fails for legitimate negative reactions.**  
   R6 explicitly requires signed sums. Consider \(L=60\), baseline \(w=0.5\), supports at **0/20**, and one N-face step over **[0,20]**, with \(q_p=30\), \(\Delta h=3\).

   | Case | Left reaction | Right reaction | Total |
   |---|---:|---:|---:|
   | From N: step 2.7 k | −13.65 | 46.35 | 32.70 |
   | From S: step 1.8 k | −14.10 | 45.90 | 31.80 |
   | Maximum-absolute reaction envelope | −14.10 | 46.35 | **32.25** |

   The proposed check rejects this correct result because **32.25 < 32.70**. Summing absolute envelope magnitudes would satisfy an inequality, but would not verify equilibrium or correct load transfer.

   **Fix:** Check signed force and moment equality separately for each physical case; present wall envelopes as design demands without an equilibrium sum claim.

2. **Blocking — R1’s equilibrium assertions and the existing handoff cannot consume the envelope as a load case.**  
   [LH.sumCheck](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/lateral-handoff.js:210>) checks `RD.analyze(...).reactions` against `res.V`. Supplying R2’s proposed envelope produces this confirmed error:

   `Roof Wind-Y: sum of line reactions 35.625 k != V 34.500 k.`

   The envelope also has reaction moment **1068.75 kip-ft**, matching neither physical case’s **1012.50 / 1057.50 kip-ft**. R5 promises governing case IDs, but IDs alone cannot reconstruct the nongoverning reactions needed for validation. Globally replacing equality with ≥ would also weaken checks on ordinary and legacy records.

   **Fix:** Define separate `cases` and `envelope` outputs, retain complete signed case reactions/totals through handoff, and run equilibrium checks only on cases; preserve legacy equality behavior.

3. **High — R3 now mixes elevation offsets with physical parapet heights.**  
   `hp_max` becomes “top of highest parapet above h,” while `h_step` and `h_typ` remain heights used to calculate loaded area. Those are different quantities on sloping roofs. For example, mean roof \(h=30\), local roof elevation 35, and `hp_max=8` give \(z_p=38\). A six-foot parapet at that location passes **6 ≤ 8**, although its top is **41 ft**, above the pressure evaluation height. Blank typical height defaulting to this redefined maximum can also give the wrong loaded area.

   ASCE requires \(q_p\) at the parapet top; changing the label does not establish that elevation. [ASCE 7-16 §27.3.4](https://www.sweetstudy.com/files/asce7-16_excerpts-3571557.pdf)

   **Fix:** Separate absolute parapet-top elevation from physical loaded height and validate local roof elevation plus parapet height, or explicitly restrict this feature to a common flat-roof datum.

4. **High — R6 leaves two incompatible downstream implementations open.**  
   “Separate signs **or signed reactions**” is not interchangeable in the current shearwall engine. [SW validation](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/stacked-shearwall.js:855>) rejects negative wall-force inputs, while [storyForces](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/engines/stacked-shearwall.js:584>) accumulates their numeric values. Passing signed envelopes into that path would either fail validation or introduce cancellation between independently selected governing cases.

   **Fix:** Specify nonnegative envelope magnitudes for existing shearwall design inputs, separate sign/case metadata for reporting, and signed physical-case arrays for equilibrium checks.

R8–R10 address the earlier loader, chord-label, and single-line concerns at the plan level. The remaining tests must include the negative-reaction envelope above and a complete two-sense handoff—not just engine envelope calculations.

VERDICT: REVISE
### Claude response to round 2
Accepted all 4: R12 cases/envelope split, R13 handoff magnitudes + case metadata + per-case Σ check, R14 common-datum restriction with sloped-roof warning, R15 tests.

## Round 3 — Codex

R12–R13 resolve the earlier envelope/sign blockers. **The plan still needs revision for height handling and validation after editing imported forces.** No files were modified.

The new numbers check out:

| Fixture | Verified result |
|---|---|
| R13, from N | **−13.65 / 46.35 k**, total **32.70 k** |
| R13, from S | **−14.10 / 45.90 k**, total **31.80 k** |
| R13 envelope | **14.10 / 46.35 k** magnitudes; signs/cases as specified |
| R15 opposite-face envelope | **17.8125 / 17.8125 k** |
| R15 shear/moment | \(V_{\max}=\mathbf{10.1125}\) k; \(M_{\max}=\mathbf{63.76265625}\) kip-ft |

Checking equilibrium per physical case, while using nonnegative envelope magnitudes for shearwall design, is sound for the stated model.

1. **High — R14 states a common-datum restriction but does not enforce it.**  
   A warning that checks only the highest top elevation does not establish the correct loaded parapet area. Consider a hip roof with mean height **30 ft**, eaves **25 ft**, and six-foot parapets topping at **31 ft**. Entering heights above datum \(h\) gives `hp_max = hp_typ = 1 ft`. The proposed top-elevation confirmation passes, but the calculator loads **one foot instead of six feet** of parapet. Entering the physical six-foot height instead makes the asserted top-elevation equation wrong. Pressure evaluation and loaded height remain distinct quantities. [ASCE 7-16 §27.3.4](https://www.sweetstudy.com/files/asce7-16_excerpts-3571557.pdf)

   **Fix:** Enforce the common roof-base datum as an eligibility condition, rejecting incompatible sloped-roof cases until separate base elevations and physical loaded heights are supported.

2. **High — R13 validates stored cases without checking the forces actually being designed.**  
   The shearwall page allows editing line forces through [updWall](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/stacked_shearwall_calculator.html:601>). Import R13’s **14,100 / 46,350 lb**, then change the second line to **0**. Both carried physical cases still satisfy equality, so the proposed header checks pass while the design uses a missing line force. Deleting or regrouping imported lines creates the same disconnect.

   **Fix:** Validate current line identities and force magnitudes against the carried-case envelopes; flag edits as overrides and withdraw the imported-load validation status until reconciled.

3. **Medium — R12’s single aggregate `governing_case` cannot describe independently enveloped shear and moment.**  
   Use \(L=60\), supports **10/50**, baseline \(w=0.5\), and one N-face step over **[0,10]**, \(q_p=30\), \(\Delta h=6\):

   | Case | \(V_{\max}\), k | \(M_{\max}\), kip-ft |
   |---|---:|---:|
   | From N | **10.3375** | 68.36390625 |
   | From S | 10.2250 | **70.550625** |

   Shear governs from N; moment and chord govern from S. One case ID necessarily misattributes part of the envelope.

   **Fix:** Store governing case IDs separately for `Vmax`, `Mmax`, and chord force, including ties where applicable.

4. **Medium — R12’s “exactly today’s single result” conflicts with R1 for unstepped overhangs.**  
   Today’s no-step 10/30/60 layout returns **10/12.5/7.5**, with reaction moment **925**, whereas R1 correctly requires **11.25/11.25/7.5**, with moment **900 kip-ft**. Preserving the result’s shape is compatible; preserving its numbers is not.

   **Fix:** Specify “same single-result shape, with R1’s overhang correction applied regardless of whether steps exist,” and test that exact no-step layout.

VERDICT: REVISE
### Claude response to round 3
Accepted all 4 (R16-R19).

## Round 4 — Codex

R17–R19 address their respective findings. I verified:

- **R18:** \(V_{\max}=10.3375\) k from N; \(M_{\max}=70.550625\) kip-ft from S. With 120-ft chord depth, \(T=0.587921875\) k from S.
- **R19:** reactions **11.25 / 11.25 / 7.50 k**, totaling **30 k**, with moment **900 kip-ft**.

**R16 still has two blocking flaws:**

1. **“θ ≤ 10°” does not establish a common parapet-base elevation.**  
   A 60-ft-wide gable roof at 10° rises **5.28981 ft** above its eaves. With eave height \(h=30\) ft and a six-foot parapet step near the gable apex, R16 accepts the roof and evaluates \(q_p\) at **36 ft**, although the actual parapet top reaches **41.28981 ft**. The eave-height convention for \(h\) does not override the requirement to evaluate parapet pressure at its top. [ASCE 7-16 §27.3.4 and Figure 27.3-1](https://www.sweetstudy.com/files/asce7-16_excerpts-3571557.pdf)

   **Fix:** Gate eligibility on all modeled parapet bases actually sharing datum \(h\), not roof angle; otherwise reject the geometry until separate base elevations are supported.

2. **Ignoring ineligible saved steps removes known loads from the calculation.**  
   R16 explicitly says saved steps are ignored in analysis. A roof containing a 30-k baseline and a 2.7-k step can therefore produce a 30-k result instead of an invalid result. A flagged table does not prevent downstream omission: [sendToShearwall](</C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs/public/Calcs/rectangular_diaphragm_calculator.html:1161>) independently recomputes the saved inputs through LH.

   **Fix:** When active, nonzero steps fail eligibility, return a fatal validation error and block results and handoff in both the page and LH; retain `#stepJSON` solely for correction.

Add tests for a low-slope gable with elevated parapet bases and an ineligible saved stepped roof passed directly to LH. No files were modified.

VERDICT: REVISE
### Claude response to round 4
Accepted both (R20).

## Round 5 — Codex

R20 closes the remaining blockers:

- Eligibility now requires a common parapet-base datum explicitly confirmed by the user; sloped MWFRS records cannot qualify through the former ≤10° exception.
- Ineligible active steps cause fatal validation rather than disappearing from the load calculation.
- Requiring LH to throw covers both quick-send and saved-file shearwall import; I checked those call paths.
- The added tests exercise the previously failing geometry and direct-import cases.

R17–R19 retain force reconciliation, separate governing cases for each response quantity, and the corrected unstepped overhang behavior. The previously verified numerical fixtures remain valid.

I found no remaining blocking flaws in the consolidated implementation plan. No files were modified.

VERDICT: APPROVED

**Converged: APPROVED at round 5.**
