# Feature Spec — deep-beam-stm v2 (2026-08-11) — **Rev 4**
_Rev 2: after Fable pre-implementation spec review (3 BLOCKER / 7 MAJOR). Rev 3: F2.5(8) per-face thicknesses, F2.5(10) ℓ_d-based extension, F2.5(14) uplift. Rev 4: fixes from Fable implementation-verification round 1 (see §R4 at the end)._

Working file, excluded from deploy commit. Two features, DECIDED spec — implement exactly; do not re-derive the engineering. Arbiter: Claude, scope set by Nick, corrected against an adversarial spec review (3 BLOCKER / 7 MAJOR / 5 MINOR / 3 NIT, all accepted).

Baseline before this work: `npm run test:stm` = 325 comparisons, 0 failures. Cases A/B/C must not change except where F1.3 explicitly caps node width — and the DEFAULT case must not change at all.

---

# FEATURE 1 — §23.8.2 tie effective-width (band) check

## F1.1 Where it applies — READ THIS FIRST

§23.8.2 limits the geometry of a nodal zone that a tie **anchors into**. It applies ONLY to node-anchored ties:

- the **bottom tie** at each end pier (Cases A/B/C/D)
- the **Case C top tie** at its anchor vertex N_a and at the overhang-side support

It does **NOT** apply to the Case D continuous negative chord. That chord is a distributed tension field running *through* the interior supports; it terminates at no node, so there is no nodal back face to limit. Applying a hydrostatic node-width limit to smeared wall steel is dimensionally self-defeating — for #4@12" EF the limit grows only 0.082" per inch of counted depth, so no nonzero counted depth is ever self-consistent and the check would either auto-fail every realistic wall or be satisfied by construction. Case D's negative chord is governed instead by F2.4b.

## F1.2 Multi-layer tie input (NEW — required to give the check teeth)

The engine currently models the tie as one layer, which makes any band-membership test true by construction. Add:

```
tieBars:   { count, size }                       // legacy: one layer at coverBot + db/2
tieLayers: [ { count, size, y_in }, ... ]        // OPTIONAL, overrides tieBars when present
                                                 // y_in = layer centroid above bottom of GB
```
A_s = Σ layers; ȳ_t = area-weighted centroid. Validation: ≥ 2 bars per layer, every layer inside the GB less covers, layers ordered, no duplicate y.

This is what lets the calculator answer the real question that prompted the feature ("can I count top and bottom bars as one tie?") with a computed answer instead of silence.

## F1.3 Quantities and behavior

- `wtPhys` = 2·ȳ_t (symmetric extended nodal zone — the existing `ha`)
- `wtMax` = F_nt/(f_ce·b_s); F_nt = A_s·f_y **nominal, no φ**; f_ce = 0.85·β_n·f'_c with β_n = 0.8 (CCT) and β_c locked at 1.0 (state this — it is why the F1.5 collapse identity is exact); b_s = `ctx.tNode` = min(t_w, b_gb)
- `wtGov` = min(wtPhys, wtMax); band = [ȳ_t − wtGov/2, ȳ_t + wtGov/2]

**Capping propagates to ALL of these — the third is new and is an unconservatism if missed:**
1. node back-face geometry `ha := wtGov`
2. strut-face width w_s = l_b·sinθ + ha·cosθ, node polygons, drawing
3. **anchorage critical section `xCrit = (wtGov/2)/tanθ`** (currently `ȳ_t/tanθ`). Capping shrinks the extended nodal zone and moves the critical section toward the bearing, *reducing* available embedment. Must be implemented and fixture-asserted.

Capping makes strut-fit and node checks **harder** (ha↓ → w_s↓ → stress↑). Those failures are genuine; do not soften them.

## F1.4 The `tie.width` row

- id `tie.width`, label "Tie effective width w_t ≤ w_t,max", aciRef "ACI 318-19 23.8.2", units "in"
- demand = wtGov, capacity = wtMax, **dcr = wtGov/wtMax** (≤ 1 by construction). Put `wtPhys` in contributions, not in demand — a dcr > 1 on a passing row would corrupt the summary's governing-DCR selection.
- **`informational: true` always** — excluded from governing-DCR and near-limit selection (reuse the existing informational mechanism used by Case C strip rows).
- `capped: true` when wtPhys > wtMax; append " (node width capped to w_t,max)" to the label.
- `pass` reflects **band membership only**: false if any counted tie layer centroid lies outside the band, with a message naming the layer and its distance outside. For a single-layer tie the layer is inside by construction — contributions must say `"single layer — inside band by construction"` so the row is not mistaken for an independent check.
- Rationale for failing rather than silently discounting out-of-band steel: auto-discounting cascades (A_s↓ → F_nt↓ → wtMax↓ → band↓) and hides the required fix from the engineer.

## F1.5 Mandatory anti-circularity disclosure

When capped, back-face stress = T/(wtMax·b_s) = f_ce·(T/F_nt), so the back-face DCR equals **exactly** the tie-strength DCR T/(0.75·A_s·f_y). The two stop being independent checks. The support-node row must carry `collapsedOntoTie: true` and say so in its derivation text.

## F1.6 Worked values (hand-computed; f'_c = 3000, f_y = 60, b_s = 12, f_ce = 2.04 ksi)

| Config | ȳ_t | wtPhys | F_nt | wtMax | wtGov | Outcome |
|---|---|---|---|---|---|---|
| 4-#8 bottom, cover 3 (DEFAULT) | 3.500 | 7.000 | 189.6 k | 7.7451 | 7.000 | not capped; `ha`, xCrit, node stress all **numerically unchanged** |
| 3-#7 bottom, cover 3 | 3.4375 | 6.875 | 108.0 k | 4.4118 | 4.4118 | capped; ha ×0.6417, back-face stress ×1.5583, **xCrit ×0.6417 → embedment drops** |
| tieLayers 3-#7 @ y=3.4375 **and** 3-#7 @ y=21.5625 | 12.500 | 25.000 | 216.0 k | 8.8235 | 8.8235 | band [8.088, 16.912]; both layers outside → **FAIL** (now producible via F1.2) |

wtMax: 189.6/24.48 = 7.7451; 108/24.48 = 4.4118; 216/24.48 = 8.8235.

## F1.7 Fixtures
`tie_width_band.json` — one run per F1.6 row, asserting demand/capacity/dcr/pass/capped/informational, the row-2 xCrit and back-face stress changes, and the row-3 failure message. Plus an explicit regression run asserting the default case's `ha`, `xCrit`, node back-face stress and anchorage DCR are identical to the pre-change values. Also assert Case C top-tie capping touchpoints (`haTopSup` = 2·ytTop at the overhang support, `haTop` at N_a) are routed through the same capping.

---

# FEATURE 2 — Case D: continuous spans over piers

## F2.1 Geometry & inputs

```
caseD: {
  nSpans: 2..5,
  L_ft, lb_in,                                  // equal spans, equal bearings
  spanPoint: [ { D_kip, L_kip }, ... ],         // one per span, at MIDSPAN
  negChord: {
    useWallEF: bool, depth_in,                  // wall EF horizontal steel counted from top of wall down
    addBars: { count, size, depth_from_top_in },
    extension_in                                // provided top-steel extension each side of interior pier CL
  }
}
```
Pier CLs at x_i = l_b/2 + i·L (i = 0..nSpans); L_w = nSpans·L + l_b. No outboard strips or overhangs — reject with a scope error. **The wall strip from each end-pier CL to its outer face (length l_b/2) lies outside the CL-to-CL analysis span: route it to the end bearing (o = 0 by construction) and say so in the results.**

## F2.2 Analysis — exact elastic, prismatic

Direct stiffness, rotational DOF at each of nSpans+1 simple supports, constant EI. FEM: UDL ∓wL²/12; midspan point ∓PL/8. Recover end moments, M(x) by superposition, reactions from end shears.

**Stated assumption:** flexure-only. Shear flexibility at ln/h ≈ 1.6 reduces continuity, which reduces M⁻ and increases M⁺ — so elastic M⁻ is conservative and elastic M⁺ is not (handled by F2.4a). **It also raises end reactions toward the simple-span value** (0.375wL → up to 0.5wL, +33%) while lowering interior reactions — handled by F2.4c.

## F2.3 Combinations and patterning

Combos 1.4D and 1.2D+1.6L. **LL patterns: each span's LL toggles as a unit** (its UDL-LL and point-LL together) — verified sufficient for enveloped M⁺, |M⁻| and reactions under gravity; independent toggling adds nothing. 1.4D carries no patterns, so runs = 2^nSpans + 1 ≤ 33. Envelope per quantity with governing combo + pattern reported.

## F2.4 Demands

**a) Positive chord.** Tpos = Mpos_env/zPos, zPos = h − a⁺/2 − ȳ_t, a⁺ = Tpos/(f_ce_strut·t_w), iterated |Δa| < 0.01" with βs resolved first (same ordering as Cases A/B).

**Capacity-consistent floor (replaces the arbitrary 50% rule):**
> Tpos ≥ [ M_ss − ½(φM_n,neg,L + φM_n,neg,R) ] / zPos

where M_ss = w_u L²/8 + P_u L/4 for that span under the same combo/pattern, and φM_n,neg,* is the negative-moment capacity actually provided at each adjacent support (= φ·A_s,neg·f_y·zNeg, 0 at an end pier). You may claim continuity relief only up to what the provided negative steel can deliver — a lower-bound-theorem statement rather than an invented percentage. Retain `Tpos ≥ 0.5·M_ss/zPos` as an additional floor. Report which floor governs as a named contribution; zPos is iterated at the floored force. The floor is a pure max() and cannot mask a governing pattern.

**b) Negative chord (no band check — see F1.1).** A_s,neg from wall EF steel over `depth_in` (centroid depth_in/2 below top of wall) plus addBars, area-weighted centroid y_neg above bottom of GB. zNeg = y_neg − a⁻/2, a⁻ = Tneg/(f_ce_strut·b_gb), iterated. Reject "geometry infeasible" if a⁻ > h_gb.
Distribution limit in place of the band check: **`depth_in ≤ 0.25·h`**, per deep-beam practice for distributing negative reinforcement; beyond that the centroid drops so far that zNeg collapses and the model is not representative. Reject above the limit with an actionable message. Note that counting deeper steel is already self-penalizing (y_neg↓ → zNeg↓ → Tneg↑).

**c) Reaction floor.** End-pier demands shall use R_end ≥ w_u L/2 + P_u/2 − M⁻_use/L with M⁻_use = 0.5·|M⁻_elastic| at the adjacent interior support. Applies to end-pier bearing, the end node, and end-span shear — consistent with the moment floor in (a).

## F2.5 Checks

1. Deep-beam applicability per span (§9.9.1.1), clear span from bearing faces.
2. Bottom tie φF_nt ≥ Tpos (§23.7.2) **+ F1 band check**.
3. Negative chord φF_nt ≥ Tneg (§23.7.2). **No band check.** Report A_s,neg, y_neg, zNeg, a⁻.
4. Positive compression chord: a⁺ band fit within the wall envelope (as Cases A/B).
5. Negative compression chord: a⁻ ≤ h_gb and stress ≤ f_ce, on width b_gb (§23.4.3).
6. **Diagonal strut per span-half** (§23.4.3) — the shear-transfer check Cases A/B get from the arch band and Case D would otherwise omit entirely. At each support face: V_face from the envelope; chord force H_local (= Tpos at midspan side, C⁻ = Tneg at an interior support); θ = atan(V_face/H_local); strut force = V_face/sinθ; width w_s = l_b·sinθ + ha·cosθ from that support's node; thickness t_w; check against φ·0.85·β_s·f'_c. Also enforce θ ≥ 25° (§23.2.7). Interior supports carry 0.625wL per side vs 0.375wL at the ends — the interior diagonal governs.
7. **End-pier node + anchorage — full Cases A/B machinery, restored.** Define **θ_end = atan(R_end/Tpos)** (the funicular springing identity); with θ_end the existing `anchorageEnd` and support-node code are callable unchanged. Check the CCT node (bearing, strut, back faces) and the bottom-tie anchorage (hook/headed/straight, nib logic) exactly as Cases A/B.
8. **Interior support node**, equilibrated: faces = bearing (up) + the two diagonal struts from item 6 + the two horizontal bottom-chord compressions. ΣV and ΣH must close — assert it. Class CCC (verified: nothing tensile enters; the negative chord is remote at the top of the wall).
   **Face thicknesses differ and must be used per face — Rev 3 correction:**
   - horizontal bottom-chord faces: **`b_gb`** (the negative compression chord lives in the grade beam, is delivered along the grade beam into the pier, and is not confined by the wall above it)
   - diagonal strut faces: **`t_w`** (those struts run through the wall)
   - bearing face: the pier/grade-beam interface width
   Checking the chord face on `t_w` (Rev 2) was **wrong**: it produced a load-independent DCR of exactly β_s·(b_gb/t_w) = 1.500 for a standard 24" GB on a 12" wall, i.e. a false failure on every Case D run regardless of loading. Size and check the chord consistently on `b_gb`. Report the width transition (12" wall → 24" grade beam across the node) as a stated modelling assumption in the derivation, not as a check.
9. **Bearing at every pier** (§22.8), end and interior reported separately.
10. **Top-steel extension** (§23.8.3 + Ch. 25): x_infl = zero-crossing of the **negative-moment envelope** (max over all combos/patterns), not the all-loaded pattern.
    **Required = x_infl + max(ℓ_d, 12d_b)** — Rev 3 correction. Rev 2 used §9.7.3.8.4's `max(d, 12d_b)` shift, but `d` here is the effective depth of a 16-ft-deep member (~182"), which produced a ~260" requirement that governed the summary of every Case D run. §9.7.3.8.4 is a **B-region** rule whose `d`-shift accounts for tension shift from diagonal cracking; in a D-region the STM models the load path directly, and the envelope-based x_infl already carries the worst live-load pattern. Develop the bar for its force past the point it is no longer required.
    **Report the §9.7.3.8.4 `x_infl + max(d, 12d_b)` value alongside as an informational row** so the engineer can see the B-region comparison and overrule if they prefer it. Compare `extension_in` against the governing (ℓ_d-based) requirement.
    **If the envelope has no zero-crossing in a span** (possible when adjacent spans are loaded and this one is not), require top steel across the full span plus development past the next pier, and say so.
11. **Bottom-bar continuity:** interior piers need NO ℓ_dh (bars run through) — state it in results. Add a **lap/splice note**: Class B tension laps, located over interior piers where the bottom fiber is in compression; report the required lap length.
12. Web reinforcement §9.9.3.1 + Table 23.5.1 per span; global shear cap §9.9.2.1 per span using the larger adjacent reaction; detailing fit — all unchanged.
13. Statics self-checks per run: global ΣV/ΣM and per-support equilibrium within the existing relative tolerance; interior-node closure from item 8.
14. **Uplift (Rev 3, previously unstated):** a patterned live load on a lightly dead-loaded continuous member can produce a genuine negative end reaction. Return `no_admissible_stm` with an actionable message naming the pier and the governing pattern — consistent with the existing Cases A/B/C negative-reaction guard. A tension connection at the pier is out of scope; the engineer must add dead load, change the pier layout, or design that connection separately.

## F2.6 Scope note (must render in results)

Case D computes chord forces from the elastic moment envelope and checks ties, chords, diagonal struts, nodes at every pier, bearing, and development. It does **not** construct a full multi-span funicular polygon. Out of scope: unequal spans, more than one point load per span, outboard strips/overhangs, moving loads, **and crack control / serviceability on the newly created top-of-wall tension face** (Case D introduces that face; the exclusion is disclosed, not silent).

## F2.7 Graphics

Multi-span elevation: wall, all piers, grade beam; bottom tie with force envelope; top-chord zones over interior piers with required-vs-provided extension dimensioned; inflection points from the envelope marked; diagonal struts drawn at each support; moment-envelope diagram beneath showing the sign change and chord swap. Section view plus negative-chord steel indicated in the upper wall. Reuse existing local SVG helpers; do not modify `are-draw.js`; keep the label-audit self-check.

## F2.8 Fixtures (hand-computed, arithmetic in `comments`)

1. **2 equal spans, UDL, DEAD LOAD ONLY** (so no patterning ambiguity): with w_u = 1.4×8.225 = 11.515 klf, L = 26 ft → M⁻ = wL²/8, M⁺ = (9/128)wL², R_int = 1.25wL, R_end = 0.375wL. Assert all four plus Tpos/Tneg with negChord inputs **explicitly specified**, tolerance 0.5%.
2. **3 equal spans, UDL, dead only** — M⁻ = 0.100wL², M⁺(end) = 0.080wL², M⁺(mid) = 0.025wL², tolerance 0.5%.
3. **2 spans, UDL + midspan point loads, dead only** — hand-solved by stiffness, every step recorded.
4. **Pattern governs** — LL on one span of two gives M⁺ = (49/512)wL² = 0.0957wL² > 0.0703; assert the governing pattern id and that the enveloped M⁺ exceeds the all-loaded value.
5. **Capacity-consistent floor governs** — assert the floor value and that the named contribution identifies it.
6. **Reaction floor governs** at an end pier.
7. **a⁻ > h_gb** → geometry infeasible; **depth_in > 0.25h** → rejected.
8. **No inflection point in a span** under the governing pattern → full-span top steel required.
9. **Interior diagonal strut governs** over the end diagonal.
10. Interior-node closure (ΣV, ΣH) asserted.

---

# Cross-cutting

Engine stays DOM-free UMD. Do not modify `are-draw.js`, `are-calc.css`, other calculators, `PLAN.md`, `PLAN-REVIEW-LOG.md`, `AUDIT-FIXES.md`, `FEATURES-v2.md`, `authority_example.json`. Same check-row contract as today. Full-precision compute, display-only rounding. Registry stays `status: "ready"`; update subtitle/keywords for continuous spans and negative moment. **No tolerance widening.** Any legitimately changed existing expectation must be hand-rederived in that fixture's comments — and per F1.6 the default case must not change at all. `npm run test:stm` fully green before handoff.

---

# §R4 — Fixes from Fable implementation-verification round 1

Round 1 returned VERIFY: FAIL with 3 MAJOR + 3 MINOR + 4 NIT. All accepted. It also CLEARED `options.tieWidthLimit`: FHWA-NHI-17-071 Ex. 1 is AASHTO LRFD §5.8.2, which builds the CCT back face directly from 2×(distance to tie centroid) and has **no** F_nt/(f_ce·b_s) cap — so the cap genuinely binds under ACI and this is a real code difference, not a misinterpretation of w_t,max. Keep the flag as implemented.

## R4.1 (MAJOR 1) — interior-node governing-face selection must skip by-construction faces
`byConstruction: true` is set on the interior chord face (engine ~1519) but never consulted; `buildChecksD` (~2040) takes a plain max over faces, so every interior-node row carries a constant floor of β_s that can reach `summary.governing` — under light load the row reports the chord face at 0.750 while the real load faces sit at 0.19/0.11.
- Exclude `byConstruction` faces from governing-face selection; fall back to them only if ALL faces are by-construction. Mirror the existing crown-row pattern (AUDIT-FIXES §C).
- Report the chord face as a **disclosure line** in the derivation, not as the governing face.
- The derivation prose at ~2058 currently claims the chord face "can never govern" — that is false as coded. Make the code true, then keep the prose.
- Update the two `case_d_continuous.json` assertions (~225–227) that currently enshrine the chord face as governing at 0.75.

## R4.2 (MAJOR 2) — interior-node closure is tautological; make it real or label it
`sumV = R[i] − dL.V − dR.V` with `R[i]` assembled from those same shears is identically zero; `sumH` is float noise because both diagonals derive H from the same Tn. The `not_converged` guard is dead code and the fixture asserts 0 ≈ 0. `globalV` in Case D is zero for the same reason.
- Add a **genuinely independent** cross-check: recompute each support reaction from the member END MOMENTS and span loads — R_i = Σ_adjacent [ w·L/2 + P/2 ± (M_left − M_right)/L ] — and assert it against the assembled reaction. This is independent of the shear assembly and would trip on a moment-distribution bug.
- Keep the ΣV/ΣH row but mark it **informational** with the text "closes by construction — model consistency, not a check", and point to the new reaction cross-check and the existing `jointRes`/`globalM` residuals as the load-bearing assertions.
- Update the fixture accordingly; do not present a tautology as evidence.

## R4.3 (MAJOR 3) — `tieLayers` bypasses the lower-half validation
engine ~239–244 tests only `coverBot + db/2 < h_gb/2` and never inspects `tieLayers[0].y`. A single layer at y = 20 in a 24" GB, and a two-layer tie at y = 13/21, both return `ok` with `tie.width` pass — a tie band nowhere near the bearing, reported as PASS, reachable from the shipped UI.
- Reject when `tieLayers[0].y >= h_gb/2` with an actionable INVALID_INPUT message.
- Mirror in `clientWarnings` (html ~1081), which has the same gap.
- Fixture both the rejection and a legitimate low two-layer tie that passes.

## R4.4 (MINOR 4) — capped xCrit must reach the drawing and the prose
`deep_beam_stm_calculator.html:1667` draws the critical section at `yt/tanθ` and html:1297 states `x_crit = y_t/tanθ` unconditionally. When capped these overstate the extended nodal zone (0.920 in actual vs 1.434 in drawn). Pass `model.tieBand.wtGov/2` into `nodalZone` and condition the formula text. Also centre the drawn nodal zone on the tie when capped rather than spanning [0..h_a] (engine ~2262/2268 and both UI paths).

## R4.5 (MINOR 5) — close the F1×F2 interaction gap
Add a `case_d_continuous` run with a **capped** 3-#7 bottom tie (exercises haEnd, end-node faces, diagonal w_s and θ_end-based xCrit through `tieBand.wtGov`), and a multi-layer **in-band PASS** assertion — currently only the fail case is covered.

## R4.6 (MINOR 6) — extend the licensed-text verification list
engine ~29–31 lists only §9.9.1.1 / Table 23.5.1 / Table 25.4.3.2 / §25.4.4.1. Add **§23.8.2** (the w_t,max cap is commentary R23.8.1 material in some printings), **§9.7.3.8.4**, and **§25.5.2** (Class B laps). These gate "ready".

## R4.7 (NITs 8–10)
- b-region contribution label (engine ~2131) prints `max(d, 12db)` under a "d = y_neg =" label via a ternary whose else-branch is unreachable — fix the label.
- `default_case.json:116` and `tie_width_band.json` call the default T "verbatim/identical" at …230259 while the engine produces …230226 (absorbed by rtol 1e-9). Correct the literals or drop the word "verbatim".
- Test-only options (`tieWidthLimit`, `pinZ_in`, `tieCentroid_in`) are honored from any caller's `inputs.options`. Unreachable today, but add a guard so a future JSON-import path cannot silently disable a code check.

## R4.8 — coverage statement
Record in the smoke checklist what the green suite does NOT prove: print output, the exact §23.8.2/§9.7.3.8.4/§25.5.2 code text, and that the FHWA fixture no longer evidences §23.8.2 by documented design (`tie_width_band.json` is the sole evidence).
