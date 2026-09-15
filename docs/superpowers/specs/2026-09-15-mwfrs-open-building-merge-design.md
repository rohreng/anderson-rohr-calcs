# MWFRS Wind — Open / Partially Open Building Merge (design)

Date: 2026-09-15
Status: approved by Nick 2026-09-15

## Goal

Extend the live MWFRS calc (`public/Calcs/asce716_mwfrs_calculator.html`, slug `mwfrs-wind`) so it covers all four ASCE 7-16 enclosure classifications. The open-building logic comes from Nick's new standalone file `RE CODING/ASCE/ASCE 7-16 Ch27 Pt1 Wind Loading Calculator - html.html` (the "source file"). One calc, one slug. The source file is not deployed.

## Inputs

| Input | Behavior |
|---|---|
| Enclosure `encl` | Enclosed / Partially Enclosed / Partially Open / Open. GCpi = ±0.18 / ±0.55 / ±0.18 / 0.00 (Table 26.13-1). |
| Roof type `roofType` (walled) | Flat, Gable/Hip, Monoslope, Mansard. Replaces Flat/Sloped. |
| Free-roof shape `freeRoofShape` (Open only) | Monoslope, Pitched, Troughed. |
| Wind flow `windFlow` (Open only) | Clear (≤ 50 % blocked) / Obstructed (> 50 % blocked). |
| Roof angle | Degrees or rise/12 (`roofAngleMode`); θ derived either way. Hidden for Flat. |
| Ground elevation `groundElev` (ft) | Ke computed per Table 26.9-1 (Ke = e^(−0.0000362·z_g)). Existing `Ke` field remains and is treated as an override when the user edits it. |
| §28.3.5 frame inputs | Number of transverse frames, As, Ae. Shown only when Open, or Partially Enclosed with a pitched roof (θ > 0). |

All other existing inputs (V, exposure, Kzt, B, D, h, hp, story heights, project info) unchanged.

## Calculation paths

### Walled path — Enclosed, Partially Enclosed, Partially Open
Existing engine, unchanged except:
- GCpi from the four-way table above.
- Roof Cp: existing flat/sloped Fig. 27.3-1 logic, plus Monoslope and Mansard handled per Fig. 27.3-1 notes (as implemented in the source file, verified in Gate 1).
Walls, roof, story shears, diaphragm forces, parapet, send-shear panel, Revit export all run as today.
§28.3.5 frame force F is added as an extra results block for Partially Enclosed + pitched roof.

### Open path — Open
Hidden: wall pressures, parapet, story shears / diaphragm, send-shear panel, Revit export.
Shown:
- Design parameters and velocity pressures (Kh, qh, Ke, G).
- CN coefficients Figs. 27.3-4 (monoslope), 27.3-5 (pitched), 27.3-6 (troughed) for γ = 0°, 180°, cases A/B, clear/obstructed, interpolated on θ.
- Transverse case Fig. 27.3-7 (γ = 90°, 270°) with the three distance zones (≤ h, > h ≤ 2h, > 2h) and cases A/B.
- Roof pressures p = qh·G·CN for every row.
- §28.3.5 longitudinal frame force F (Eqs. 28.3-3, 28.3-4), with KB, KS, GCpf(0°) and GCpf(180°) shown.
- Minimum-load / design-load-case summary (§27.1.5, Fig. 27.3-8).

Both paths keep the existing project-info block, are-utils toolbar, Mark field, print, save/load.

## Save / load compatibility
Existing saved states carry `roofType: "flat" | "sloped"`. Loader maps `flat → flat`, `sloped → gablehip`. New keys (`freeRoofShape`, `windFlow`, `roofAngleMode`, `groundElev`, frame inputs) default when absent.

## Regression guard
Before any edit, `tools/test-mwfrs-wind.mjs` captures outputs from the current calc into `fixtures/mwfrs-wind/baseline.json` for these cases:
1. Enclosed, flat, 3 stories, parapet 3 ft.
2. Enclosed, sloped 20°, 2 stories, no parapet.
3. Partially Enclosed, flat, 1 story, parapet.
4. Partially Enclosed, sloped 35°, 3 stories.
Captured per case: wall pressures per story both directions, roof pressures, parapet pressures, story shears, diaphragm forces, Revit payload, and a save→load→recalc round-trip.
After the merge the same harness must reproduce the baseline exactly (tolerance 1e-9 on numbers).

## QAQC gates (Fable agents, both blocking)
**Gate 1 — pre-merge, source file.** Agent reads the source file and `RE CODING/ASCE/ASCE 7-16.pdf` and checks:
- Table 26.13-1 GCpi; Table 26.9-1 Ke; Table 26.10-1 α, z_g; Eq. 26.10-1.
- Fig. 27.3-1 wall Cp and roof Cp incl. monoslope/mansard treatment.
- Figs. 27.3-4/5/6 CN tables (every θ row, clear and obstructed, cases A/B, both γ).
- Fig. 27.3-7 transverse zones.
- §28.3.5 Eqs. 28.3-3/28.3-4, KB, KS, GCpf(0°/180°) per Fig. 28.3-1.
- §27.1.5 minimums and Fig. 27.3-8 cases.
- Hand-computes three open cases (monoslope clear, pitched obstructed, troughed clear) and compares to the source file.
Output: findings list with code reference, source-file line, and severity. Findings are fixed during the merge.

**Gate 2 — pre-deploy, merged calc.** Agent checks:
- Regression harness passes against baseline.
- Hand-checks one enclosed case and two open cases end-to-end against the merged calc.
- Walks every enclosure × roof-type UI combination in a browser: correct panels shown/hidden, no NaN, no console errors.
- Save→load round-trip on an open case and on a legacy `roofType: sloped` state.
- Revit payload byte-identical for enclosed cases.
Output: pass/fail with findings. Deploy only after pass and Nick's go.

## Deploy
`are-calcs-deploy` skill. Commit from `/tmp/are-git` (core.worktree points at the OneDrive repo; the in-place `.git` is stale).

## Out of scope
- Free-roof pressures in the Revit payload.
- Chapter 28 envelope procedure beyond §28.3.5.
- Rooftop structures / equipment (§29).
