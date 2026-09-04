# QAQC — APA Wood Structural Panel Uniform Load Calculator

**Date:** 2026-09-04
**Source calculator:** `Billy Anderson's files - ARE_CODING\WOOD\APA Sheathing and Decking\APA_panel_uniform_load_calculator.html`
**References:** APA Technical Note Q225J, *Load-Span Tables for APA Wood Structural Panels* (Dec 2024); APA *Panel Design Specification* Form D510F (2020)
**Result:** Tabulated data verified correct. 8 findings corrected. Website version: `public/Calcs/apa_panel_uniform_load_calculator.html` (Members / Wood).

## 1. Data verification (all match)

| Item | Source | Method | Result |
|---|---|---|---|
| Uniform load tables 1a, 1b, 1c, 1d, 2a, 2b, 2c, 2d, 3 (every span rating x 5 rows x 13 columns) | Q225J pp. 3-12 | Script parsed the PDF text and compared every value incl. the perpendicular / parallel split | 9/9 tables identical |
| Table 4 sanded plywood adjustments C_C (5 groups x 3 grades x 2 axes x stiffness/bending/shear) | Q225J p. 13 | Hand check | All 90 factors match; NA cells match |
| Table 5 duration C_D (0.90 / 1.00 / 1.15 / 1.25 / 1.60) | Q225J p. 14; D510 Table 6 | Hand check | Match |
| Table 5 span adjustments 2-to-1 (0.42 / 1.00 / 1.25), 3-to-1 (0.53 / 0.80 / 1.20) | Q225J p. 14 | Hand check + beam-coefficient derivation | Match. 3-to-2 (1.28 / 0.80 / 0.96) was missing - F1 |
| Table 5 wet-service C_M (0.85 stiffness, 0.75 strength) | Q225J p. 14; D510 Table 8 | Hand check | Match |
| Span-count basis (perp: 3-span <= 32", 2-span > 32"; parallel: 3-span <= 16", 2-span at 24") | Q225J p. 2; D510 4.7.1 | Hand check | Match |
| Support-width assumption (2x < 48", 4x >= 48") | D510 4.7.2 | Hand check | Match |
| Thickness by span rating and predominant (bold) Performance Category | D510 Table 12 | Page rendered and read | All 11 rows match |
| Panel weights (plywood / OSB, 3/8" through 1-1/8") | D510 Table 13 | Hand check | All 11 rows match |
| Example 1 (32/16 plywood sheathing, perp, 16", floor) | Q225J p. 15 | Engine test + browser | Total 173 psf (bending), live 163 psf - exact |
| Example 2 (OSB Sturd-I-Floor 24 o.c., perp, 32", single span, snow C_D 1.15) | Q225J p. 16 | Engine test + browser | 27.6/41.3/55.1/82.8/226.3 -> APA 28/41/55/83/226; total 55 (L/180), live 41 (L/240) - exact |

Q225J footnote (b) still cites "Table 5 of D510" for the thickness range; in D510F-2020 that content is Table 12. The calculator's citation is correct for the current edition.

## 2. Findings and corrections

| # | Severity | Finding | Correction |
|---|---|---|---|
| F1 | Engineering | Table 5 "3-Span to 2-Span" adjustment (1.28 / 0.80 / 0.96) not offered; a two-span panel at a spacing whose tabulated basis is 3-span could not be checked. | Added "Two Spans" field condition. Applied only when the basis is 3-span; otherwise the tool says no adjustment applies. |
| F2 | Engineering | Live check showed "-" (no status) when dead load alone exceeded the allowable total (allowable live <= 0). | Live check reports D/C = infinity and FAIL with the reason. |
| F3 | Record integrity | "+ Add to Dead Load" button added panel weight on every click (double counting) and was invisible in a saved record. | Replaced with an "Include panel self-weight" checkbox showing the D510 Table 13 weight; the addition is itemised in the demand card and calc detail and round-trips through Save/Load. |
| F4 | Usability | Invalid states raised browser alert() dialogs. On the site the Mark field re-runs the calc per keystroke, so this would alert per keystroke. | Marine disabled for Groups 2-4; all errors are an inline message that hides stale results. |
| F5 | Documentation | Table 2a footnote (e) shown only for W24; it applies to every deflection row of Table 2a. | Hint for all Table 2a ratings; footnotes (d) and (e) in the notes. |
| F6 | Documentation | Creep (D510 4.5.1 / Table 7) is not in Q225J Table 5. | Conditional note when Permanent duration is selected. |
| F7 | Documentation | Loads not identified as ASD; APA nearest-5-psf rounding not mentioned. | Block badged "ASD, unfactored"; rounding note added. |
| F8 | Code hygiene | Undefined SVG marker `#arrPerp`; D510 cited without edition. | Removed; edition added. Engine refactored into DOM-free `APA.compute()` so it is unit-testable. |

## 3. Website integration

- Registry: `app/lib/calcs.ts` slug `apa-panel-uniform-load`, category Members, material Wood, spec "APA Q225J (2024) / D510 (2020)"
- Template: `are-calc.css` + `/are-utils-v2.js` (site theme, Project + Mark toolbar, Save / Save-as / Load, Summary and Full Calc print, Expand/Collapse, Results Hub)
- Mark renders in the header band and the result summary; saved filename: `<project> - APA Wood Structural Panel - <mark> - <date>.html`
- Tests: `npm run test:apa` (60 assertions incl. Examples 1 and 2); manifest gate; toolbar sweep 57/57; save/load round-trip pass (16 fields); `next build` clean
