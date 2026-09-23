# Parapet steps + wind-direction nomenclature (2026-09-23)

Fable-planned; Codex review log appended below. Head at planning: 05e4073. Paths under `public/` unless noted.

## Request (Nick)
- Nomenclature: "Wind-X: wind E–W, normal to the E and W faces — resisted in-plane by the N and S shearwalls (EW walls)"; "Wind-Y: wind N–S, normal to the N and S faces — resisted in-plane by the E and W shearwalls (NS walls)". Both MWFRS and Diaphragm pages.
- MWFRS: Maximum parapet height (q_p at its top) and Min/Typical parapet height (used across the full building width). Send typical parapet × width to the Diaphragm.
- Diaphragm: stepped-parapet table (distance from 0,0 = SW building corner, step width, step height). Additional force = p × (h_step − h_typ) × width. Reactions from ΣM about 0,0 = 0, with a table of shearwall lines and their distances from 0,0.

## Findings (head 05e4073)

### F1. Direction convention — code consistent, labels ambiguous
- MWFRS `calcDir(L, Bperp, label)` `asce716_mwfrs_calculator.html:685-748`; `wx = calcDir(B, Ddim, 'Wind-X (EW)')` `:750`, `wy = calcDir(Ddim, B, 'Wind-Y (NS)')` `:751`. Wind-X: L = B, B⊥ = D; `F_net = p_net × trib_h × Bperp` `:714`.
- Diaphragm `RD.analyze` (`engines/rect-diaphragm.js:133-142`): `wx = calcDir(Vx, D, B, swX)` → Wind-X spans D between the X rows (EW-running walls at `loc` from S).
- Strings to replace — Diaphragm: `:138, :142, :190-191, :215-216, :264, :269, :512, :522, :542, :544, :787-788, :829-830, :1033-1034` (`:564-676` is a dead `if(false)` block). Engine labels `rect-diaphragm.js:137-140` only read via `indexOf('X')` `:732`.
- MWFRS: `:181-182, :200, :235, :239, :633-634, :885`, plan arrows ~`:1350-1358`, `:1377-1385`, `:1297`.
- Trap: `tools/test-mwfrs-wind.mjs:89-102` diffs every string in `window.__mwfrsLast` vs `fixtures/mwfrs-wind/baseline.json` — `wx.label`, `roofX.dir`, `open.normalLabel` values must not change (DOM text only).
- `LH.AXES` (`engines/lateral-handoff.js:49-52`) is user-visible on the Shearwall import panel; asserted at `tools/test-stacked-shearwall.mjs:908`, `tools/test-lateral-handoff.mjs:83` (fixture `mwfrs-record.json` axes), `test-rect-diaphragm.mjs:445` heading regex.

### F2. Existing MWFRS parapet — integrate
- `#hp` `:196` (Tier-A; `MWFRS_INPUT_IDS` `:1570`; URL prefill `:1826`); hidden for open buildings via `#hpRow`.
- `:753-782`: `zp = h + hp`, `qp = qz(zp)`, `pp_WW = 1.5 qp`, `pp_LW = −1.0 qp` (§27.3.4, Eq. 27.3-3); `F_par = 2.5 qp hp B⊥` added to `rows[0].F_net`, `V_cum` re-summed. Typical parapet force already rides the roof diaphragm force and the handoff (`F_parapet_x/y_strength_lb`, `lateral-handoff.js:126`). `p_p`, `h_typ` not in the record.
- Rendered `:943-968`, `renderParapet` `:974-992`, Revit payload `:1711-1716`, `__mwfrsLast.parapet` `:856`, `LH.fromMwfrs` gets `hp` only.
- Compat: MWFRS has no `loadFromState` shim → a new Tier-A field id makes old snapshots hit `notInFile` (`are-utils-v2.js:1641-1663`). Diaphragm shim `:1222-1250` is the template.

### F3. Diaphragm load / reaction model (`engines/rect-diaphragm.js`)
- 1 line `R = V` `:38-39`. 2 lines `:40-50`: statics with overhangs. 3+ lines `:51-59`: tributary to midpoints (= simple spans between adjacent lines, overhang UDL to end line).
- Shear/moment `:64-110`; `chord_T = M/B_perp`, `v_dia = Vmax/B_perp`.
- `wallsFor` maps reactions back by loc (`lateral-handoff.js:189-207`); `sumCheck` requires Σ reactions == `res.V` (`:210-214`) → `res.V` must be the total incl. steps.
- `levelFromDiaphragmState` `:218-279`; `F_wind_x_strength_lb = round(Vx × 1000)` `:244`; MWFRS cross-check warning at 0.5 % `:259-272`.
- Shearwall: `toShearwallState` writes per-wall `P_wind_lb` `:442`, floor `P_wind_lb` `:448`; Σ check `stacked_shearwall_calculator.html:1072-1084`.
- Diaphragm persistence: hidden carriers `#swJSON`/`#mwfrsJSON`; `test-rect-diaphragm.mjs:143-144` requires `#swJSON` be the only `/^#sw/` key; `:307-314` level-switch SKIP list.

## Engineering basis (ASCE 7-16)
- §27.3.4, Eq. 27.3-3: `p_p = q_p (GC_pn)`, GC_pn +1.5 windward, −1.0 leeward, q_p at top of parapet (§26.10). Net 2.5 q_p per ft of height along a face pair.
- q_p evaluated once at `z = h + h_p,max` (conservative for typical and every lower step).
- Typical: `w_typ = 2.5 q_p h_typ` (plf); `F_par,X = w_typ × D`, `F_par,Y = w_typ × B`. With `h_typ = h_max` this equals today's formula → baseline unchanged.
- Steps: N/S-face step → Wind-Y; E/W-face step → Wind-X. `Δh_i = max(0, h_step − h_typ)`. Recommended `p_step = +1.5 q_p` (windward) per step, summed — envelope of both wind senses (exact for a single step; conservative when steps face each other). `F_i = p_step Δh_i w_i`, partial UDL over `[x_i, x_i + w_i]`, centroid `x̄_i = x_i + w_i/2`. N/S-face steps measured from the W corner; E/W-face steps from the S corner.
- Reactions — 2 lines, ΣM about (0,0): `ΣM_0 = V·L/2 + Σ F_i x̄_i`; `R_b = (ΣM_0 − ΣF·a)/(b − a)`, `R_a = ΣF − R_b`, `ΣF = V + ΣF_i`. 3+ lines: each step segment overlapping span `[L_k, L_k+1]` (length s, segment [p,q], `F_seg = w_i (q − p)`, `c = (p+q)/2`) split by span statics `R_k += F_seg (L_k+1 − c)/s`, `R_k+1 += F_seg (c − L_k)/s`; overhang overlap wholly to the end line. Global ΣF = 0 always; global ΣM_0 = 0 for 2 lines and 3+ lines without overhangs (report per span otherwise).
- Step loads enter `V_max`, `M_max`, chord T (fixture a: v_dia 125 → 140 plf, T 1.875 → 2.105 k). Reactions-only would be unconservative.
- Seismic runs get no steps; seismic parapet weight out of scope.

## Data contract (`are.lateral.v1`, additive)
- MWFRS stage: `geometry.hp_typ_ft`; top-level `parapet: {hp_max_ft, hp_typ_ft, z_p_ft, qp_psf, GCpn_ww: 1.5, GCpn_lw: -1, pp_ww_psf, pp_lw_psf, pp_net_psf, p_step_psf, w_typ_plf}` or null when hp = 0.
- Diaphragm stage: `F_wind_x/y_strength_lb` = total (UDL + steps); add `F_parapet_step_x/y_strength_lb`, `parapet: {p_step_psf, h_typ_ft, steps: [{label, face, start_ft, width_ft, h_ft, dh_ft, F_strength_lb, x_ft}]}`. MWFRS cross-check compares `F_wind − F_step`.

## Work packages

Wave 1 (parallel):

**WP-1 — RD engine** (`engines/rect-diaphragm.js`; new `tools/test-rect-diaphragm-engine.mjs`, `test:rd`)
1. `calcDir(..., opts)` with `opts.steps = [{label, start, width, F}]`. Reactions per model above. Additive return keys: `V_udl`, `V_steps`, `V` (total), `steps[]` (with segments), `moment: {about:0, rows[{item,F,x,Fx}], sumF, sumM, checkF, checkM}`, `spans[]` for 3+.
2. Shear/moment: 2 lines piecewise-linear V, |V| at breakpoints, |M| at breakpoints and V-zeros (reproduces today exactly at zero steps). 3+ lines per-span.
3. `analyze(o)` accepts `o.parapet = {p_step_psf, h_typ_ft, steps:[{label, face, start_ft, width_ft, h_ft}]}`; face → direction; validate/clamp with `warnings[]`; seismic no steps. `RD.stepForces(parapet, B, D)`.
4. `ENGINE.version` → 2 (update `test-lateral-handoff.mjs:50`).
5. Test: frozen copy of today's `calcDir`; bitwise-equal at zero steps for Red Bluff + ~20 random layouts; fixtures a/b/c; ΣF/ΣM checks.

**WP-2 — MWFRS page** (`asce716_mwfrs_calculator.html`, `tools/test-mwfrs-wind.mjs`)
1. Relabel `#hp` → max parapet height; add `#hpTyp` (blank = h_p,max) in `#hpTypRow`, visibility mirrors `#hpRow`; add to `MWFRS_INPUT_IDS`.
2. `hpTyp` parse; `parapetData` gains `hp_max, hp_typ, pp_net, p_step, w_typ_plf`; `applyParapet` uses `hp_typ`; `__mwfrsLast.hpTyp`.
3. `renderParapet` shows h_p,typ, z_p, net 2.5 q_p, step 1.5 q_p, w_typ; footnote.
4. `buildLateralPayload` passes `hpTyp`, `parapet`; Revit payload additive.
5. `loadFromState` shim defaulting `#hpTyp` = '' (hard requirement).
6. Nomenclature DOM text only.
7. Tests: baseline unchanged; hpTyp 2 with hp 3 → F_parapet × 2/3; payload; old state loads; hidden for open.

Wave 2 (parallel, after WP-1):

**WP-3 — Diaphragm page** (`rectangular_diaphragm_calculator.html`, `tools/test-rect-diaphragm.mjs`)
1. "Stepped Parapets (roof level, §27.3.4)" block: `#ppStep`, `#hpTyp`, `#stepsAtLevel`, hidden `#stepJSON`; rows Label, Face, Start from (0,0), Width, Step height; read-outs direction, Δh, F_i, x̄_i.
2. `calculate()` passes parapet; `renderDir` shows V_udl + Σsteps; step-load table; "Reactions by statics about (0,0)" table with shearwall lines and distances, F_i, x_i, F_i·x_i, per-line R with equation, ΣF/ΣM check rows.
3. `applyLateralRecord` fill-blank `#ppStep`, `#hpTyp`; `applyMwfrsLevel` sets `#stepsAtLevel` on for roof only; shim defaults; Save/Load JSON.
4. Nomenclature.
5. Tests: heading regex; SKIP list; ROOF fixture zero mismatch; fixture a rendered; level switch drops steps; round trip.

**WP-4 — Handoff** (`engines/lateral-handoff.js`, `tools/test-lateral-handoff.mjs`, `fixtures/lateral/red-bluff/mwfrs-record.json`, `tools/test-stacked-shearwall.mjs:908`)
1. `AXES` reworded; update fixture + substring.
2. `fromMwfrs` adds `hp_typ_ft`, `parapet`. `levelFromDiaphragmState` reads step carriers, passes to `RD.analyze`, totals incl. steps, `F_parapet_step_*`, `parapet` block; ASD entry ÷0.6 rule for step force (p_step is strength). Cross-check uses `F_wind − F_step`. `summarize` notes steps.
3. Tests: version; fixture equality; round trip (f); old ROOF fixture identical (g); `toShearwallState` floor 32,700, walls 16,800 / 15,900 for fixture a.

Wave 3 — WP-5: `docs/calc-state-spec.md`, run `test:rd test:dia test:lat test:mwfrs test:sw`.

## Hand-computed fixtures
Common: B = 60 ft, D = 120 ft, Wind-Y Vy = 30 k → w = 0.5 k/ft on span 60, chord depth 120; p_step = 45 psf (q_p 30 × 1.5), h_typ = 3 ft; one N-face step start 10 ft from W, width 20, height 6 → Δh 3, F₁ = 2.7 k at x̄ = 20 ft, w₁ = 0.135 k/ft on [10, 30].
- (a) 2 lines (W @ 0, E @ 60): ΣF 32.7; ΣM₀ = 900 + 54 = 954 k·ft; R_E = 15.90, R_W = 16.80; V-zero x = 28.583, M = 252.6 k·ft (225.0 without); Vmax 16.80 → v_dia 140.0 plf (125.0); T 2.105 k (1.875).
- (b) 3 lines (+ interior @ 30): no steps 7.5 / 15.0 / 7.5; with step R = 8.40 / 16.80 / 7.50; span-1 M = 68.1 k·ft; Vmax 9.30 → v 77.5 plf.
- (c) straddling step [20, 40]: R = 7.725 / 17.25 / 7.725; span-1 M = 59.67 k·ft; Vmax 8.625 → v 71.9 plf.
- (d) zero steps: Red Bluff goldens unchanged; frozen calcDir bitwise equality.
- (e) MWFRS Red Bluff (h 35.5, hp 4.5): 2.5 q_p = 53.80 psf, q_p 21.52; hpTyp 3 → F_par,x 58,107 lb, F_par,y 19,369 lb, p_step 32.28 psf, w_typ 161.4 plf.
- (f) round trip: walls.Y R 16,800 / 15,900, F_wind_y 32,700, F_step_y 2,700; applyLateralRecord fills #ppStep 32.28, #hpTyp 3.
- (g) old files load with zero mismatches; goldens identical.

## Acceptance
- All suites green; MWFRS baseline diff empty with #hpTyp blank; no backslash-hex; are-theme-v2.css untouched; no schema bump.
- No "along EW/NS" left in DOM text.
- Diaphragm output shows step table, ΣM₀ table, per-line reactions with equations, zero check rows; V_max, M, T include steps.
- Shearwall import of a stepped roof: floor P_wind = Σ wall lines.

## Risks
- MWFRS notInFile rollback without the shim.
- `__mwfrsLast` baseline string paths.
- Steps leaking into lower-level files (auto-off on level switch).
- ASD-entered diaphragm with steps (÷0.6 rule).

## Open questions for Nick (recommended answers)
1. Per-step GC_pn: +1.5 on every step, summed (recommended) vs 2.5 net.
2. q_p at h + h_p,max for everything: yes.
3. Step loads in diaphragm shear/chord: yes.
4. 3+ lines: simple-span split of each step segment (recommended) vs point load at centroid.
5. Input by face (N/S/E/W), direction shown.
6. Steps on the Diaphragm page only.
7. Seismic parapet weight: out of scope.

## Revision 1 (after Codex round 1) — supersedes conflicting text above

R1. **3+ line overhang model (pre-existing engine defect, fix it).** Current tributary rule sends the whole overhang UDL to the end line, violating global ΣM (walls 10/30/60, L 60, w 0.5: reactions 10/12.5/7.5, ΣR·x = 925 vs 900). New model: simple spans between adjacent lines, with each overhang treated as a cantilever on its end span (end span = beam with overhang; statics about the far support of that span). Walls 10/30/60 → 11.25/11.25/7.5. Every accepted layout must satisfy global ΣF = 0 and ΣM₀ = 0 (asserted in the engine and displayed). Moment diagram in the end span includes the cantilever. Layouts with no overhang are unchanged → Red Bluff goldens preserved; any fixture with 3+ lines and an overhang changes and is listed for Nick.

R2. **GC_pn — two wind senses, enveloped (replaces "1.5 on every step").** Per direction, run two load cases: Wind-Y from S (S face windward +1.5 q_p, N face leeward 1.0 q_p acting in the same sense) and Wind-Y from N (reverse); likewise Wind-X from W / from E. Step force F_i = GC × q_p × Δh_i × w_i with GC = 1.5 if the step's face is windward in that case, 1.0 if leeward. Typical parapet (2.5 q_p h_typ) is identical in both cases. Analyze each case fully (reactions, V, M, chord) and envelope: per-wall reaction = case with max |R|; V_max, M_max, T = max over cases; display both cases' reaction tables with the governing case flagged. Handoff: per-wall reaction = enveloped value with governing case id; floor total = max case total; the Σ-wall-lines check on the Shearwall page becomes Σ ≥ floor total with a note (enveloped per wall), not equality. `p_step` in the contract is replaced by `qp_psf` + `GCpn_ww 1.5` + `GCpn_lw 1.0`.

R3. **q_p height enforced.** MWFRS sends `hp_max_ft` and `z_p_ft`. Diaphragm rejects (error, no result) any step with h_step > hp_max_ft ("re-run MWFRS with a higher maximum parapet"). Add MWFRS note: for sloped roofs, h + h_p,max must be the highest parapet top elevation; field label says "top of highest parapet above h".

R4. **Load basis.** p/q from MWFRS are strength level. Steps are computed at strength; for an ASD-entered page (`#loadLevel = asd`) display step forces × 0.6 alongside the ASD baseline, and export strength baseline (converted once, existing path) + strength steps. Fixture: ASD baseline 18 + ASD step 1.62 = 19.62 k displayed; export 32.70 k.

R5. **assemble()** (`lateral-handoff.js:~383`) explicitly copies `F_parapet_step_*`, level `parapet`, envelope case ids, and `geometry.hp_typ_ft`. Test: snapshot → level → assembled record → Shearwall import preserves them.

R6. **Signs.** `wallsFor` carries separate `sign_wind` / `sign_seis` (or signed reactions); Shearwall page applies each to its own force; sum checks use signed values. Keep the legacy `sign` key for older consumers (= sign of wind).

R7. **Parapet inputs are source-owned.** On MWFRS import, `#qp`, `#hpTyp`, `#hpMax` on the Diaphragm are OVERWRITTEN (unlike titleblock fill-blank) and shown read-only with an "unlock to override" toggle; an override that differs from the record's values shows a warning in results (typical load in V no longer consistent). Cross-check compares the typical-parapet line load too.

R8. **Legacy loaders.** Defaults for absent keys in BOTH `AREv2.loadFromState` shim and legacy `applyInputsMWFRS` JSON path (`#hpTyp` → '' ). Diaphragm step-row inputs carry `data-are-ignore`; `#stepJSON` is authoritative. Test: load an old file into a page already holding hpTyp = 2 and steps → both reset.

R9. **Chord labels (pre-existing mislabel).** Wind-X: diaphragm spans D (NS) between the N and S shearwalls; depth B → chords are NS-running members at the E and W edges. Wind-Y: chords are EW-running members at the N and S edges. Fix `renderDir` text (~:730-735) and any comment. Step coordinate labels: "x from W corner" (N/S-face steps), "y from S corner" (E/W-face steps).

R10. **Single line.** Steps with only one shearwall line in that direction → error ("eccentric parapet step needs ≥ 2 shearwall lines; rotational restraint not modeled").

R11. **Tests.** Legacy goldens kept only for layouts without overhangs; new deterministic fixtures: overhang 10/30/60 (11.25/11.25/7.5), two-sense envelope with opposite-face steps (Codex counter-example: supports 10/50, L 60, w 0.5, q_p 30, steps [0,10] N and [50,60] S... Δh 6), mixed-sign wind vs seismic, ASD (19.62 / 32.70), one-line rejection, h_step > hp_max rejection. Fixture (f) split: a 45 psf-equivalent round trip (q_p 30) and the Red Bluff import (q_p 21.52) computed separately. Fixture (a)-(c) numbers re-derived under R2: a single N-face step is windward in "from N" case (1.5 q_p) and leeward in "from S" (1.0 q_p) → governing case = from N, same numbers as before (p = 45 psf). Round M = 59.68 in (c).

## Revision 2 (after Codex round 2) — supersedes R2/R3/R6 where they conflict

R12. **Cases vs envelope contract.** Engine returns, per direction with steps, `cases: [{id:'fromN'|'fromS'|'fromW'|'fromE', reactions:[signed k], V_total, Vmax, Mmax, chord_T, moment:{sumF,sumM,checkF,checkM}}]` and `envelope: {reactions:[{abs, sign, governing_case}], Vmax, Mmax, chord_T, governing_case}`. Equilibrium (ΣF, ΣM₀ equality) is checked **per physical case only**; the envelope is presented as design demand with no equilibrium claim. Directions without steps produce exactly today's single result (no `cases`), so legacy records and `LH.sumCheck` equality are unchanged. `sumCheck` for stepped levels runs over each carried case (equality), never over the envelope. The R2 "Σ ≥ floor total" check is withdrawn.

R13. **Handoff shape.** Level record per direction with steps carries `cases` (full signed reactions per wall id + totals) and per-wall envelope. `toShearwallState` writes per-wall `P_wind_lb` = envelope magnitude (≥ 0, as the SW engine requires), sign/governing case as metadata only (`sign_wind`, `case_wind`); floor `P_wind_lb` = max case total. Shearwall Σ-wall-lines header check: for stepped levels, verify each carried case's signed Σ equals that case's total (display "enveloped per wall — Σ of envelopes ≠ story total by design"); unstepped levels keep today's equality. Seismic keeps its own `sign_seis`; legacy `sign` retained = wind sign for unstepped levels. Negative-reaction fixture: supports 0/20, L 60, w 0.5, N-face step [0,20], q_p 30, Δh 3 → fromN −13.65/46.35 (32.70), fromS −14.10/45.90 (31.80), envelope 14.10(−, fromS) / 46.35(+, fromN); both cases pass equality; SW receives 14,100 / 46,350 lb magnitudes with the negative flagged as today.

R14. **Height datum (replaces R3 wording).** Feature restricted to a common roof datum: all parapet heights (h_p,max, h_typ, h_step) are physical heights above the roof datum h used by the MWFRS; parapet top elevation = h + height; q_p at h + h_p,max; validation h_step ≤ h_p,max. MWFRS sends `roofType`/θ; for non-flat roofs (θ > 10° or any sloped/gable/hip type) the Diaphragm shows a persistent warning "parapet heights measured above datum h; on a sloped roof confirm h + h_p,max ≥ the highest parapet top elevation" and the MWFRS label reads "Max. parapet height above roof datum h". Blank typical = h_p,max (loaded area on the same datum).

R15. Tests add: negative-reaction envelope (R13), full two-sense handoff MWFRS → Diaphragm → assemble → Shearwall with case equality checks, opposite-face envelope 17.8125/17.8125 with M 63.763, V 10.1125, legacy equality unchanged for unstepped levels.

## Revision 3 (after Codex round 3)

R16. **Datum enforced (replaces R14 warning).** Stepped parapets are eligible only when the MWFRS record's roof is flat or θ ≤ 10° (where the MWFRS already uses the eave height as h, so roof base ≈ datum h). Otherwise the Diaphragm step table is disabled with an error ("stepped parapets require a common roof base — flat/low-slope roofs only in this version") and any saved steps are ignored in analysis (kept in `#stepJSON`, flagged). For a hand-entered Diaphragm page with no MWFRS record, a required "Roof is flat / low-slope (θ ≤ 10°)" checkbox gates the table. The MWFRS typical/max parapet fields keep today's behavior for all roof types (existing #hp semantics).

R17. **Current-force reconciliation on Shearwall.** For levels imported with carried cases, the SW page compares each current line (by wall id) to its imported envelope magnitude (±1 lb). Any edited/deleted/regrouped line flips the level's import status to "OVERRIDDEN — imported-load validation withdrawn" listing the differing lines (imported vs current); the per-case Σ checks are shown only while status is reconciled. Test: import R13 → set line 2 to 0 → status overridden, line listed.

R18. **Per-quantity governing case.** `envelope` stores `Vmax:{value, cases:[ids]}`, `Mmax:{value, cases:[ids]}`, `chord_T:{value, cases:[ids]}` (ties list all), and per-wall `governing_cases`. Fixture: supports 10/50, L 60, w 0.5, N-face step [0,10], q_p 30, Δh 6 → Vmax 10.3375 (fromN), Mmax 70.550625 (fromS), chord from fromS.

R19. **Unstepped results.** "Same single-result shape, with the R1 overhang correction applied whether or not steps exist." Test the no-step 10/30/60 layout → 11.25/11.25/7.5, ΣR·x = 900. Layouts without 3+ lines + overhang are numerically unchanged (Red Bluff goldens).

## Revision 4 (after Codex round 4) — replaces R16

R20. **Eligibility = common base, confirmed; ineligible = fatal.** Stepped parapets require (a) MWFRS roof type flat (not gable/hip/monoslope of any angle), or no MWFRS record, AND (b) an explicit checkbox `#ppCommonBase` "All parapet bases are at roof datum h (parapet top = h + height)" — required whenever any active nonzero step exists. If active nonzero steps exist and either condition fails, `RD.analyze` returns a fatal validation error for that level: the page shows the error and no results, and `LH.levelFromDiaphragmState` throws (so `sendToShearwall`, "Save level" handoff and Shearwall import are all blocked). `#stepJSON` is retained only for correction. Sloped roofs with parapets stay on today's MWFRS typical-parapet path only.
Tests: 10° gable record + active step → fatal in page and in LH direct call; flat + unchecked box → fatal; flat + checked → runs; saved ineligible stepped roof loaded then passed straight to LH → throws.
