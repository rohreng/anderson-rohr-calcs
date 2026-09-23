# ASCE 7-22 C&C wind calculator — pre-deploy verification (2026-09-23)

Verifier: Fable (senior structural engineer + code reviewer). Scope: commits adaae76 (harness), 44b6dd4 (7-16 corrections), 20b1fab (7-22 edition), 48b278c (backcheck fixes) on `public/Calcs/asce716_cc_wind_calculator.html`, `tools/test-cc-wind.mjs`, `fixtures/cc-wind/`. Verified against the code page images (ASCE 7-22 pp. 338, 378, 380–386, 389, 395, 400; ASCE 7-16 pp. 268, 335–339, 347, 363) and the extracted text of §26.10, §30.3, §30.4, §30.6, §30.7 (7-22) and §30.5, §30.8, §30.9 (7-16). No code was edited.

## Verdict: **SHIP**

No BLOCKER or MAJOR findings. Every transcribed coefficient, breakpoint, Kz row, equation form and zone pairing matches the code pages; every hand-computed scenario matches the calc to full precision; both harness modes pass; edition switching, legacy load, save/load round trip and payloads behave as specified. The MINOR items below are cosmetic and can follow in a later commit.

---

## 1. Engineering provisions — ASCE 7-22 (all verified against the page images)

| Provision | Code source | Calc | Result |
|---|---|---|---|
| Velocity pressure | Eq. 26.10-1 (p. 338): `qz = 0.00256 Kz Kzt Ke V²` (no Kd) | `qhRaw = 0.00256·Kh·Kzt·Ke·V²`; card/detail print qh without Kd | OK |
| Kd placement | Eqs. 30.3-1, 30.4-1, 30.6-1, 30.7-1 all carry Kd in p | `qEff = qhRaw·Kd` multiplies (GCp ∓ GCpi); parapet `qpEff = qpRaw·Kd`; Step 4 prints `qh × Kd × [...]` | OK |
| Table 26.10-1 | p. 338, all 23 rows B/C/D 0–500 ft | `KZ_TABLE_22` — checked every cell (B 0.57…1.46, C 0.85…1.74, D 1.03…1.89) | OK |
| Note 3 interpolation | "Linear interpolation for intermediate values of height z is acceptable" | `getKhBracket` linear between rows, clamp 15/500 ft; used at h and h+hp | OK |
| Ke | Table 26.9-1 (identical both editions) | `#Ke` input, default 1.00 | OK |
| GCpi | Table 26.13-1: enclosed ±0.18, partially enclosed ±0.55, partially open ±0.18, open 0 | 0.18 option relabelled "Enclosed / Partially Open" in 7-22 | OK |
| Fig 30.3-1 walls | Z4 −1.1→−0.8 @500; Z5 −1.4→−0.8 @500; pos +1.0→+0.7 @500; break at 10 | `22:30.3-1` | OK |
| Fig 30.3-2A | Z1 −1.7→−1.0 @500; Z1′ −0.9 (≤100)→−0.4 @1000; Z2 −2.3→−1.4 @500; Z3 −3.2→−1.4 @500; pos +0.3→+0.2 @100; OH 1/1′ −1.7→−1.6 @100→−1.0 @500; OH2 −2.3→−1.1 @500; OH3 −3.2→−1.1 @500 | shares the 7-16 table (figures identical) | OK |
| Fig 30.3-2A zones | Zone 2 = 0.6h band; Zone 3 = 0.6h × 0.2h corner L; Zone 1 0.6h–1.2h; Zone 1′ beyond 1.2h | descriptions, SVG, 0.6h/0.2h card | OK |
| Fig 30.3-2A Note 5 (hp ≥ 3 ft) | positive GCp Zones 2/3 = wall Zones 4/5; Zone 3 negative = Zone 2 | positive substitution applied (both editions); Zone 3 negative reduction NOT taken (D-10, conservative); row desc flags it | OK |
| Fig 30.3-2B | Z1 −2.0→−0.5 @300; Z2 −2.7→−1.0 @200; Z3 −3.6→−1.8 @100; pos +0.6→+0.3 @200; Note 5 → §30.7 overhangs | `22:30.3-2B` | OK |
| Fig 30.3-2B/2C zone plan | Zone 2 = rake strips a + ridge strip a each side; Zone 3 = a × a at ridge ends; no eave zone | descriptions + `gable22SVG('BC')` | OK |
| Fig 30.3-2C | Z1 −1.5→−0.8 @200; Z2 −2.5→−1.2 @100; Z3 −3.0→−1.4 @100; pos +0.6→+0.3 @200 | `22:30.3-2C` | OK |
| Fig 30.3-2D | Z1 −1.8→−0.8 @100; Z2 −2.0→−1.0 @200; Z3 −2.5→−1.0 @200; pos +0.9→+0.5 @200; Zone 3 = a × a corners, Zone 2 = rake strips | `22:30.3-2D`, `gable22SVG('D')` | OK |
| Fig 30.3-2E | Z1 −1.8→−0.8 @200; Z2 −2.4→−1.3 @200; Z3 −2.6→−1.4 @200; pos +0.7→+0.3 @100; Zone 3 eave strips a, Zone 2 bands a each side of hips/ridge | `22:30.3-2E`, `hip22SVG` | OK |
| Fig 30.3-2F | Z1 −1.4→−0.8 @100; Z2 = Z3 −2.0→−1.0 @100; pos as 2E | `22:30.3-2F` | OK |
| Fig 30.3-2G (θ = 45°) + Note 6 | Z1 −1.5→−0.7 @100; Z2 −1.8→−0.8 @100; Z3 −2.4→−1.0 @100; `GCp = [GCp(2G) − GCp(2F)]·(θ−27)/18 + GCp(2F)` | `evalZone`: t clamped [0,1], `g2F + t·(g2G − g2F)` per zone at the same A; θ = 27 reproduces 2F exactly (probed) | OK |
| Fig 30.3-5A | Z1 −1.1; Z2 −1.3→−1.2; Z2′ −1.6→−1.5; Z3 −1.8→−1.2; Z3′ −2.6→−1.6 (all 10→100); pos +0.3→+0.2; primed = high-eave side; 3′ 2a × 4a, 3 2a × 2a, 2′ 2a strips, 2 a strip | shares 7-16 table; sum-rule overhangs 1/2/2′/3/3′ | OK |
| Fig 30.4-1 (h > 60) | walls flat to 20 sf: Z4 −0.9→−0.7, Z5 −1.8→−1.0, pos +0.9→+0.6 @500; roof Z1 −1.4→−0.9, Z2 −2.3→−1.6, Z3 −3.2→−2.3 @500; a = 0.1L ≥ 3 | `22:30.4-1-wall/-roof`; `a = max(0.1L, 3)`; windward walls on qh (Note 4 permits qz; conservative, D-9) | OK |
| h > 60 applicability | §30.4.2 Exception: Figs 30.3-1…30.3-6 permitted for 60 < h < 90 ft when h ≤ least horizontal dimension; Fig 30.4-1 Note 6: θ > 7° roofs use Fig 30.3-2/30.3-5 with qh | three callouts, all worded correctly | OK |
| Parapets §30.6 / Fig 30.6-1 | `p = qp Kd((GCp) − (GCpi))`, qp at top of parapet; Case A = wall (+) Zones 4/5 with roof (−) Zones 2/3; Case B = wall (+) with wall (−) | qp from Note 3-interpolated Kh at h+hp; Zone 4 ↔ roof Zone 2, Zone 5 ↔ roof Zone 3; hips (2E/2F/2G) take worse of Zones 2/3 for both rows; 5A takes min(2, 2′) / min(3, 3′); GCpi cancels on a solid parapet (stated in detail) | OK |
| Overhangs §30.7 | Fig 30.3-2A plotted curves for θ ≤ 7°; otherwise GCp = roof top + adjacent wall bottom at the same A | 2A rows from the figure; all other figures spawn sum-rule rows `roofNeg − wallPos` (wall positive of the same height class, D-13); `pNeg = qEff·(GCp,OH − GCpi)` (D-3) | OK |
| Zone dimension a (h ≤ 60) | min(0.1L, 0.4h) but ≥ max(0.04L, 3 ft) | `Math.max(Math.min(0.1L, 0.4h), Math.max(0.04L, 3))` | OK |
| Min pressure | §30.2.2, 16 psf | note only (unchanged) | OK |

## 2. ASCE 7-16 corrections (44b6dd4) and the Note 5 change (48b278c)

Checked every table in `GCP` against the 7-16 figure pages (200–900 dpi crops):

- Fig 30.3-1 (p. 335): Zone 5 now ends −0.8 at 500 sf (was −1.0). Correct.
- Fig 30.3-2A (p. 336): Zone 2/3 end −1.4 (were −1.6/−2.0); Zone 1′ −0.9 → −0.4 at 1000; overhangs end −1.1/−1.0; new Overhang 1/1′ row. Correct.
- Fig 30.3-2B (p. 337): roof 3r −3.6→−1.8 @100; 2n/2r/3e −3.0→−1.0 @250; 1/2e −2.0 flat to 20 → −0.5 @100; pos +0.7 @2 → +0.3 @100. Overhang 3r −4.7→−1.5 @250; 3e −4.1→−2.3 @100; 2n/2r −3.5→−2.0 @250; 1/2e −2.5 flat to 20 → −1.5 @100 (confirmed on the 900-dpi crop). Correct. Option relabelled "Gable, 7° < θ ≤ 20°" (was "Gable/Hip 7–27°"), correct per the figure title.
- Fig 30.3-2D (p. 339): 3e −3.2 @2 → −1.0 @300; 2n/3r −2.0→−1.0 @200; 1/2e/2r −1.8→−0.8 @100; pos +0.9→+0.5 @100; overhangs 3e −4.0 @2 → −1.8 @300, 2n/3r −2.8→−1.8 @200, 1/2e/2r −2.6→−1.6 @100. Correct; the old constant −2.2 / −3.7 rows had no basis.
- Fig 30.3-5A (p. 347): all five curves level at 100 sf (old tables sloped to 500 and were unconservative for Zone 3′). Correct. The old overhang rows had no figure source and were removed (D-7); the note points to the 7-22 sum rule.
- Fig 30.5-1 (p. 363): values unchanged; labels moved from 7-10 numbering (30.6-1/§30.6.2) to 7-16 (30.5-1/§30.5.2/Eq. 30.5-1). Correct. 7-16 parapet = §30.8/Eq. 30.8-1/Fig 30.8-1; overhang = §30.9/Eq. 30.9-1 — confirmed in the 7-16 text.
- Table 26.10-1 (p. 268): rows 250–500 ft appended (B 1.28…1.56, C 1.53…1.77, D 1.68…1.89) — checked cell by cell; step-down lookup replaced by Note 3 linear interpolation (the step-down was unconservative for h between rows). Correct.
- Interpolation: least-squares fit replaced by exact piecewise log-linear (`interpSeg`); 559 curve probes at 1e-9 in the harness.
- Zone dimension a: was `max(0.1L, 0.4h, 3)` (wrong, display only); now the figure definition.
- Note 5 (48b278c): hp ≥ 3 ft with Fig 30.3-2A sets Zones 2/3 positive GCp to the wall curve in both editions. Correct per the figure note; `Zone 3` negative reduction correctly not taken. New objects are created (shared `GCP['30.3-2A'].zones` are not mutated).
- Overhang wording: "include both upper and lower surfaces" now matches Fig 30.3-2A Note 6 / 2B Note 5 / 2D Note 5; the old "add to top surface" text was wrong.

Unintended changes: none found. The Phase 0 diff touches only the tables, interpolation, Kz, labels, `a`, the 2A/5A SVGs and `__ccLast`; the ten-case baseline diff is clean in the default run and the legacy file reproduces b1.

## 3. Edition switching, labels, state

Rendered headlessly (Playwright, `page.route` on `public/`, same as the harness) in both editions with walls + 2B + overhangs + 3 ft parapet:

- `<title>`/h1/tags/badges/hints/notes/reference-table footer/parapet row tags follow `REF[ed()]`; no cross-edition leaks in results, detail panels, figure notes or SVG titles (my scanner's hits were the edition dropdown text, hidden `<option>` text, and script source captured by a regex — not rendered content; "Fig 30.6-1" in 7-22 is the correct parapet figure).
- 7-22 detail: Step 2 has no Kd; Step 4 and the parapet Step 3 print `qp × Kd × (…)`. 7-16 detail unchanged.
- Zone plans: 7-22 2B/2C/2D/2E/2F/2G/30.4-1 draw the 7-22 geometry with 7-22 figure numbers; 7-16 2B/2D/5A/30.5-1 keep theirs.
- Legacy file (no `#edition/#Ke/#theta`) loads as 7-16, Ke 1.00, θ 45, no rollback, reproduces baseline b1.
- Round trip (7-22, 2E, hp 2.5, Ke 0.93): `captureState` → fresh page → `loadFromState` → identical `__ccLast.zones` and `qpEff`. Saved fields: `#edition … #theta … #effArea, #masonTrib` (`#sendZoneSel` excluded).
- `localStorage.ARE_cc_wind` carries `edition`, `Ke`; Revit payload `are.cc.wind.v1` unchanged shape plus `inputs.edition/Ke/theta_deg` and `code`. Send-to-calculator panel unchanged (parapet + non-overhang rows).
- Sweeps: 34 (7-16) and 58 (7-22, hp 3) figure combinations render with no NaN/undefined and no page errors.

## 4. Hand-computed design scenarios (independent script; figure curves typed from the pages, Kz interpolated by hand)

All values match the calc to < 0.001 psf.

**S1 — 2-story wood hip roof, 6:12 (26.6°), ASCE 7-22.** V 115, Exp C, h 25 ft (mean), L 32 ft, Fig 30.3-1 + Fig 30.3-2F, A 20 sf, overhangs.
Kh 0.94, qh = 0.00256·0.94·115² = 31.82 psf, qEff = 27.05 psf, a = max(min(3.2, 10), max(1.28, 3)) = 3.2 ft.
Zone 4 +30.5 / −33.2; Zone 5 −39.9; roof Zone 1 +20.5 / −37.9; Zones 2/3 −50.8; Overhang 1 = 27.05·(−1.219 − 0.947 − 0.18) = −63.5; Overhangs 2/3 −76.4 psf.

**S2 — 45 ft flat roof with 3 ft parapet, both editions.** V 115, Exp C, L 80 ft, Fig 30.3-1 + 30.3-2A, A 50 sf.
Kh(45) = 1.04 + 0.5·(1.09 − 1.04) = 1.065; Kh(48) = 1.08. 7-16: qh 30.65, qp 31.08 psf. 7-22: qh 36.06, qp 36.56 psf (no Kd), qEff 30.65 / qpEff 31.08 → identical pressures, as expected for identical Exp C rows. a = 8.0 ft.
Walls Zone 4 +32.4 / −35.4; Zone 5 −40.9. Roof Zone 1 +12.6 / −48.8; Zone 1′ −33.1; Zone 2 −64.7; Zone 3 −80.9; Zones 2/3 positive = 30.65·(0.877 + 0.18) = +32.4 (Note 5). Parapet Zone 4: A = 31.08·(0.877 + 1.930) = 87.2, B = 57.6; Zone 5: A = 31.08·(0.877 + 2.459) = 103.7, B = 63.1 psf. Both editions cite the right section/figure/equation.

**S3 — 85 ft office, Exp B, ASCE 7-22.** V 115, L 120 ft, Fig 30.4-1 walls + roof, A 40 sf.
Kh,B(85) = 0.90 + 0.5·(0.92 − 0.90) = 0.91 (7-16 table would give 0.945); qh 30.81, qEff 26.19 psf; a = 12 ft.
Wall Zone 4 +26.6 / −27.2; Zone 5 −47.3 (GCp −1.628 from the 20-sf plateau); roof Zone 1 −36.7, Zone 2 −58.4, Zone 3 −80.2 psf.

**S4 — gable 25° with overhangs, ASCE 7-22 Fig 30.3-2C.** V 130, Exp C, h 22 ft, L 40 ft, A 30 sf.
Kh(22) = 0.916, qh 39.63, qEff 33.69 psf, a = 4 ft.
Roof Zone 1 +22.6 / −47.9; Zone 2 −69.4; Zone 3 −81.4; Overhang 1 = 33.69·(−1.243 − 0.916 − 0.18) = −78.8; Overhang 2 −100.2; Overhang 3 −112.3 psf.

Edge probes: 2G at θ = 27° equals 2F (1e-9); h 70 + 2E prints the Note 6 callout; 5A + parapet uses min(2, 2′) = −1.549 and min(3, 3′) = −2.095; 7-16 2D + parapet uses 2e/2r/2n min and 3e/3r min.

## 5. Harness

`node tools/test-cc-wind.mjs` — 63 PASS / 0 FAIL, tail:
```
PASS 7-22 sweep: 58 wall × roof × overhang combinations (hp 3) render
PASS Phase 0 sweep: 34 wall × roof × overhang combinations render
PASS no page errors

ALL PASS
```
`node tools/test-cc-wind.mjs --phase0` — 49 PASS / 0 FAIL, tail:
```
PASS Phase 0 interpolation: 559 curve probes at 1e-9
PASS legacy state predates edition, Ke and theta
PASS legacy state loads without rollback or mismatches
PASS legacy state reproduces b1 Phase 0 snapshot
PASS Phase 0 sweep: 34 wall × roof × overhang combinations render
PASS no page errors

ALL PASS
```

## 6. Findings

No BLOCKER. No MAJOR.

**MINOR-1 — Sign-convention header is not edition-keyed.** `asce716_cc_wind_calculator.html` line 156 (`SIGN CONVENTION — Design Pressure: p = qh[(GCp) − (GCpi)]`) and the SVG formulas at lines 181/192 omit Kd in 7-22. Fix: give the header a `data-ref="pEqLow"` span (the SVG text can stay generic or read "q" instead of "qh").

**MINOR-2 — h > 60 detail Step 4 prints the low-rise equation form.** `buildZoneDet` line 1942 prints `p = qh[(GCp) − (GCpi)]` / `p = qhKd[(GCp) − (GCpi)]` for every figure while citing Eq. 30.5-1 / 30.4-1, whose form is `p = q(GCp) − qi(GCpi)`. Numerically identical (q = qi = qh here). Fix: use `R.pEqHigh` when `hiFig`.

**MINOR-3 — Downward (positive) overhang case not evaluated.** Sum-rule overhang rows carry only the uplift combination (roof (−) minus wall (+)); the downward case (roof (+) plus wall (−)) is never governing for the figures implemented but is not shown. Fix (optional): add `pPos = qEff·(roofPos − wallNeg + GCpi)` to sum-rule rows, or state the omission in the overhang note.

**NOTE-1 — Fig 30.3-1 Exception (θ ≤ 7°, L > 300 ft → a ≤ 0.8h) not implemented.** Only bites for L > 300 ft with 0.04L > 0.8h (h < 15 ft); result is a larger corner zone (conservative). Mention in the a card or leave.

**NOTE-2 — a for h > 60 with a pitched-roof figure.** With a `22:30.4-1-*` wall and a `22:30.3-2*` roof, `a = max(0.1L, 3)` is used for the roof too; the roof figures define `min(0.1L, 0.4h) ≥ …`. Differs only when L > 4h (a becomes larger, conservative).

**NOTE-3 — Overhang Note 7 not surfaced.** "a measured from the outside edge of the overhang; L excludes overhangs" — the calc takes the entered L. Worth one hint line next to `#minDim` when overhangs are on.

**NOTE-4 — Parapet zone pairing for gable figures is conservative, not exact.** For 7-22 2B/2C/2D and 7-16 2B/2D the Zone 4 parapet uses the roof Zone 2 family even along eaves that are Zone 1 in those figures; the Zone 5 parapet uses Zone 3 even where the corner is Zone 2. Acceptable (envelope), consistent with §30.6 "edge or corner zone".

**NOTE-5 — 7-16 has no hip figures (30.3-2E–2I) or 20–27° gable (2C).** Documented non-goal; the 7-16 figure notes direct to the 7-22 edition. A jurisdiction still on 7-16 with a hip roof has no path in this calc.

**NOTE-6 — `#h` max 300 while Kz runs to 500 ft; `option.hidden` relies on browser support (disabled is also set, so selection is blocked everywhere).**

**NOTE-7 — Spec errata (already known):** Fig 30.4-1 Note 6 and Tables 30.6-1/30.7-1 still cite "Fig 30.3-2A–2I" / "Fig 30.5-1"; Fig 30.6-1 Case B note says "Zones 2 or 3" for the wall (should be 4 or 5); 7-16 Fig 30.3-2A notation "θ = 10°"; C30 Tables C30.3-2/-4 typos. The calc follows the figures, not the errata.

## 7. Building-official readiness

Nothing found that would embarrass an engineer. Every printed number is traceable in the detail panels (Table 26.10-1 rows and interpolation fraction, Eq. 26.10-1 with Ke, breakpoint lists, Note 6 t-factor, §30.7 sum terms, parapet Cases A/B with qp at h+hp), and every citation is the correct edition's section/figure/equation. Conservative choices (Note 5 negative reduction and Fig 30.4-1 Note 7 not taken, qh on windward walls, GCpi on overhangs, Zone 4/5 ↔ 2/3 envelope) are the safe side and are stated on the page.
