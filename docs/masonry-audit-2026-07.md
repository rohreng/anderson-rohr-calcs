# Masonry calculator audit — July 2026

> **FIX PHASE COMPLETE — 2026-07-11.** All findings below are resolved except two NEW findings awaiting an EOR ruling. Final strict gate: `AGGREGATE PASS STRICT acknowledged=2 executed=21/21 calculators=10/10 mismatches=0 diagram_failures=0 harness_errors=0` (re-runnable: `node tools/masonry-audit/run-audit.mjs`).

## Fix-phase resolution summary

| Finding | Status | Resolution |
|---|---|---|
| MAB-1 (CALC ERROR) | **RESOLVED** | Per EOR ruling: Eq. 6-7 net tensile area (0.142 in²); crushing reproduces MDG 9.3-11's 7,180 lb (3-sig-fig per MDG), full derivation rendered. |
| MAB-2 (DIAGRAM) | **RESOLVED** | Bond-beam elevation + plan rebuilt: face shells, webs, grouted cell, headed bolt, cones retained; also fixed literal-string dim labels and a NaN label position (pre-existing bugs). |
| ANCHOR-1 (HIDDEN VALUE) | **RESOLVED** | Total-embedment + head-thickness entry mode added (lb = emb − t_head rendered); effective-mode states no deduction applied. |
| ANCHOR-2 (CALC ERROR) | **RESOLVED** | Per-provision area bases; governing steel branches use Eq. 6-7 threaded area; MDG 9.3-2's gross-area 5.890 kips retained as labeled non-governing comparison; REK-08 reproduces Ba=4.969 k / Ab=0.334 / Apt=95.03 / crushing 2.853 k. Bonus fix: lbe≥b no longer invents a 0.01" opposite edge. |
| ANCHOR-3 (HIDDEN VALUE) | **RESOLVED** | f'm = 1,750 psi selectable; REK-08 fixture drives it. |
| ANCHOR-4 (DIAGRAM) | **RESOLVED** | Parametric shells/webs, open vs grouted cells, anchors in grouted cells. |
| MASASD-1 (HIDDEN VALUE) | **RESOLVED** | Axial P input + cracked-section P+M path per §8.3.4.2.2 (unity check explicitly rejected); both REK-04 printed points reproduce (D/C 0.337 / 0.814); slenderness scope disclosed. |
| MASASD-2 (DIAGRAM) | **RESOLVED** | Real block section: shells, webs, grouted center cell with bar, open cells labeled. |
| BEARING-1 (CALC ERROR) | **RESOLVED** | Parametric group projection Apt = t·[(n−1)s + 2·√(lbe²−(t/2)²)] = 133.66 in², Bab = 6,989 lb (REK-09). NOTE: MDG's printed "25.26 − 7" is an OCR artifact of "2(5.26) + 7" — do not "fix" this back. |
| BEARING-2 (DIAGRAM) | **RESOLVED** | W16-proportioned beam, bond-beam course with grouted anchor cells, coursing with shells/webs. |
| LAP-1 (DIAGRAM) | **RESOLVED** | Real unit section: shells, web, grouted vs open cell, bar at true cover (fixed latent always-centered bug); elevation grouted column. |
| LINTEL-1 (HIDDEN VALUE) | **RESOLVED** | REK-06 sizing chain rendered: As,req = 0.43 in² (j≈0.9 sizing step per MDG) and Ms = 687,572.5 lb-in with verification narrative. |
| LINTEL-2 (DIAGRAM) | **RESOLVED** | Lintel depth drawn as real grouted courses (7 @ 8" for 56"), running-bond joints, bars at eff_d. |
| LJ-1 (HIDDEN VALUE) | **RESOLVED** | Direct jamb M/V/P demand mode (additive; DR-02 solver unchanged — verified: 0 unity-check occurrences, Eq. 8-10/8-14 intact); REK-04 points drive and pass; 645,251 lb·in conversion rendered. |
| LJ-2 (DIAGRAM) | **RESOLVED** | Four views kept; coursing, head joints, grouted bar cells added. |
| RWALL-1 (FLAG) | **RESOLVED by ruling** | Mapped to REK-02 (OOP), REK-03 (axial+flexure), REK-05 (in-plane shear). Fixtures installed; see NEW findings below. |
| RWALL-2 (DIAGRAM) | **RESOLVED** | OOP section rebuilt: coursing, shells, grouted bar cell, parapet rendering (hTotal wired to redraw — pre-existing gap). |
| URWALL-1 (FLAG) | **RESOLVED by ruling** | Hand-derived Table 11.3.1 benchmark (6", h=9 ft) installed: 7 of 8 assertions pass. See NEW findings. |
| URWALL-2 (DIAGRAM) | **RESOLVED** | End + interior webs added; open cells bound to grout condition. |
| EMBED-1 (FLAG) | **RESOLVED by ruling** | docs/embed-plate-hand-check-2026-07.md: every check hand-verified within ±0.5%; zero escalations; DR-01 methodology confirmed as implemented. |
| EMBED-2 (DIAGRAM) | **RESOLVED** | Beam profile, 4 rods, coursing/grout distinction; half-lens Apt view untouched. |

**Diagram acceptance:** all 10 calcs re-judged post-fix against their checklists from live screenshots (tools/masonry-audit/diagram-review/) — all PASS. `are-draw.js` was NOT modified (all drawing inline per calc), so the 36-consumer smoke requirement does not trigger.

## NEW findings — discovered building the ruling benchmarks (PENDING EOR RULING)

Recorded in fixtures (`pending_eor_ruling` / `benchmark_not_drivable`) and the decision register (DR-03). Not fixed this round — wall-calc section-model surgery needs an explicit EOR decision.

- **RWALL-3 (CALC ERROR, conservative direction):** in-plane shear area = face shells only (640 in² for REK-05 wall) vs MDG Anv = 968 in² (grouted cells + webs) → fv 25.16 vs 16.6 psi (+52%). Allowable side applies γg to the masonry term rather than only the 2√f'm cap.
- **RWALL-4 (CALC ERROR, UNCONSERVATIVE):** out-of-plane one-way shear divided by full per-ft net area → fv 3.42 vs MDG 13.95 psi (~4× under-predicted).
- **RWALL-5 (CALC ERROR, convention):** OOP wind moment enters the "D + 0.6W" combo unfactored (axial wind term IS factored) — a user entering ultimate C&C psf over-predicts M by 1.67×; entering pre-reduced pressure is currently required.
- **RWALL-6 (CALC ERROR, UNCONSERVATIVE):** allowable axial masonry coefficient 0.30·f'm vs TMS 0.25·f'm (+20%). Partially offset by the face-shell-only An (net effect for REK-03: Pa 13,891 vs MDG 16,300 lb/ft).
- **RWALL-7 (HIDDEN VALUE):** f'm select lacks 1,750 psi (blocks REK-02/03 driving; REK-05 driven at 2,000 since fv is f'm-independent).
- **URWALL-3 (CALC ERROR, minor/conservative):** Fb coded 0.33·f'm vs Eq. 8-13 f'm/3 (495 vs 500 psi).
- **URWALL-4 (FLAG, missing limit state):** no P ≤ Pe/4 buckling check (Eq. 8-10/8-14) — Em never computed.
- **URWALL-5 (FLAG, missing limit state):** no out-of-plane shear check (§8.2.6.2).

---


Audit baseline: `84af9632678594555db4ceffca78ec88186a49ee`. Scope is audit/report only. No calculator, product file, `are-draw.js`, reference, branch, worktree, or commit was changed. Frozen inputs remain in [the decision register](masonry-audit-decision-register-2026-07.md).

## Executive result and deploy gate

The corrected pre-fix gate executed **15 fixtures across all 10 calculators**, with zero missing/incomplete runs, harness errors, or captured page errors. Aggregate **PASS** means the audit infrastructure is complete; benchmark mismatches remain findings and no fix or deployment is authorized.

Findings: **3 CALC ERROR, 5 HIDDEN VALUE, 10 DIAGRAM, 3 FLAG**. Held back pending per-calculator approval/ruling: headed anchor bolt, top-of-wall anchor, masonry ASD design, bearing/uplift, lintel ASD, lintel/jamb, reinforced wall, unreinforced wall, and embed plate. Lap length has a diagram finding but its MDG number passes.

## Decision register

The carried embed-plate and lintel/jamb constraints in the separate decision register remain audit inputs, not defects. REK-08 was rechecked: the extraction is readable and prints f'm=1,750 psi, 3/4-in bolt, 10 tpi, effective lb=5.5 in, Apt=95.0 in², Apv=91.4 in², Ab=0.334 in², Ba=4,970 lb, Bv=2,852 lb, and maximum interaction 0.225.

## Numbered findings

### Headed anchor bolt

- **MAB-1 — CALC ERROR.** MDG 9.3-11 prints nominal masonry crushing = 7,180 lb. The corrected scraper captures the rendered result directly: `Masonry Crushing … nom=6,990 lb`. The difference is outside tolerance. The calculator uses threaded Ab=0.127 in²; MDG uses 0.142 in². Proposed fix: adjudicate the governing bolt-area basis, then change math and shown work together after approval.
- **MAB-2 — DIAGRAM.** Elevation/plan are cones inside anonymous rectangles; they do not show recognizable bond-beam face shells, webs, or cells. Symbolic lb/lbe dimensions do not contradict the driven values. Proposed fix: draw actual grouted bond-beam block geometry around the existing parametric anchor/cones.

### Top-of-wall anchor

- **ANCHOR-1 — HIDDEN VALUE.** MDG 9.3-2 enters total embedment 5.0 in and deducts the 11/32-in head to get effective lb=4.66 in; the UI accepts only effective lb. Proposed fix: expose total embedment/head or explicitly show the conversion as an input assumption.
- **ANCHOR-2 — CALC ERROR.** REK-08/TMS Eq. 6-7 prints threaded Ab=0.334 in² for the 3/4-in, 10-tpi bolt. This calculator uses gross area 0.442 in² in its ASD steel/crushing branches. Proposed fix: use Eq. 6-7 threaded area where required, subject to approval.
- **ANCHOR-3 — HIDDEN VALUE.** REK-08 f'm=1,750 psi is not an available select option, so the real example is `not_drivable`; the runner drives the closest available option only to prove the block. Proposed fix: permit 1,750 psi/custom f'm.
- **ANCHOR-4 — DIAGRAM.** Section and plan use hatched rectangles without CMU shells/webs/cells or a distinct grouted cell. Dimensions Lb=4.66, lbe=3.81, b=7.625, and S=16 match math. Proposed fix: replace the anonymous wall shape with parametric block geometry.

### Masonry ASD design

- **MASASD-1 — HIDDEN VALUE.** The driven REK-04 section reproduces fv=7.90 psi for V=964 lb, b=32 in, and net shear depth basis, but axial P is not an input. The three printed P+M interaction points (including M=39,775 lb-in/P=15,026 lb and M=45,685 lb-in/P=4,639 lb) cannot be reproduced. Proposed fix: expose axial P and the combined interaction path or clearly limit this calculator to M/V-only work.
- **MASASD-2 — DIAGRAM.** “Masonry Cross Section” is an anonymous hatched rectangle with a dot; no face shells, webs, cells, grout distinction, or bar-in-cell representation. Its b=32, l=7.625, d=3.81 labels match the driven math. Proposed fix: draw the actual multi-cell wall segment.

### Bearing/uplift

- **BEARING-1 — CALC ERROR.** REK-09 prints Apt=133.7 in² and Bab=6,991 lb. The driven calculator renders Apt=152.50 in² and Bab=7.97 kip because it uses `t × (lp_stud + 2lbe)`; bearing stress 250.48 psi and Abr=69.38 in² pass the printed 250 psi/69.4 in² values. Proposed fix: model the printed group projection/edge deductions rather than the larger rectangle.
- **BEARING-2 — DIAGRAM.** The plan captures the bearing footprint, but “Elevation — Bearing & Uplift” uses a rectangular beam instead of W16 geometry and does not show the MDG stud/embed condition, adjacent grouted cells, shells, or webs. Displayed bp/lp/t/lbe and loads match math. Proposed fix: rebuild the elevation from the REK-09 section.

### Lap length

- **LAP-1 — DIAGRAM.** MDG 9.2-1 passes numerically (19.50 in) and shown values include K=5.625, f'm=2,000, fy=60,000, and 12-in minimum. The section is a hatched square without recognizable shells/webs or open-versus-grouted cell distinction. All drawn numeric dimensions match. Proposed fix: show a real centered grouted CMU cell.

### Lintel ASD

- **LINTEL-1 — HIDDEN VALUE.** REK-06 final demands pass tolerance: M=53,755 vs 53,771 lb-ft, V=11,468 vs 11,463 lb, fv=28.91 vs 28.9 psi, uplift |M|=122,080 vs 122,125 lb-in. The MDG substituted design values As,req=0.43 in² and allowable steel moment Ms=687,572 lb-in are absent from rendered shown work. Proposed fix: add the full reinforcement sizing/capacity substitution.
- **LINTEL-2 — DIAGRAM.** The elevation shows loads and correct clear/L/bearing/depth dimensions, but the 55-in lintel is a filled band without course shells, webs, cells, grout distinction, or bar-in-cell geometry. Proposed fix: render five-to-seven actual CMU courses/bond beams parametrically.

### Lintel/jamb

- **LJ-1 — HIDDEN VALUE.** REK-04's printed direct M/V/P interaction points cannot be entered: the UI shares P with lintel reaction generation and has no direct jamb M/V/P combination inputs. The fixture records the blocking input and still drives the available path. Proposed fix: expose a direct REK-04 jamb demand mode.
- **LJ-2 — DIAGRAM.** Four views render and their driven span/bearing/thickness/height/cover labels agree with math, but elevations do not show recognizable individual shells/webs and jamb open versus grouted cells are not distinct. Proposed fix: preserve the four-view layout while adding block/cell/grout semantics.

### Reinforced wall ASD

- **RWALL-1 — FLAG.** REK-02–05 cover multiple building-level systems that are not exposed as one input set; REK-04 section/shear and jamb portions are now separately benchmarked, but the remaining branches lack complete direct fixtures. Nick must select which complete example maps to this calculator before approval.
- **RWALL-2 — DIAGRAM.** The CMU plan view does distinguish grout cells, but the out-of-plane “Wall Section” is the reported anonymous strip without block shells/webs/cells. h=12 ft, t=7.63, d=3.81 and plan spacing labels match math. Proposed fix: rebuild the section while retaining the useful plan.

### Unreinforced CMU wall

- **URWALL-1 — FLAG.** No matching MDG worked example was found for this exact 4/6-in combined axial/wind surface; no benchmark was invented.
- **URWALL-2 — DIAGRAM.** The schematic shows face shells and a hollow core with correct h/t/load labels, but the required CMU end webs are absent. Proposed fix: complete the block cross-section geometry.

### Embed plate beam bearing

- **EMBED-1 — FLAG.** No MDG example matches the combined fixed 2×2 horizontal-anchor/bearing/AISC plate model. DR-01 remains authoritative; no hand-derived oracle was introduced.
- **EMBED-2 — DIAGRAM.** The anchor-group half-lenses are visible, but the beam is a rectangle rather than a recognizable profile and the wall is a brick-like grid without CMU shells/webs/cells or open/grouted distinction. Sx/d/Lb/plate/standoff labels match runtime values. Proposed fix: rebuild the beam/wall elevation while retaining the correct half-lens group view.

## Recovered MDG fixtures and results

| Example | Printed inputs/outputs recovered | Driven result |
|---|---|---|
| REK-04 ASD, pp. 19-30–19-39 | b=32 in, depth=7.625 in, As=.40, M/V/P combinations; Vmax=964 lb; fv=7.9 psi; Fvm=47.1 psi | Section fixture fv=7.90 PASS; full P+M not drivable (MASASD-1/LJ-1) |
| REK-06 ASD, pp. 19-45–19-50 | L=10.67 ft, f'm=1,750, Em=1.575e6, w=519, P=17,390, M=53,771, V=11,463, t=55, d=52, b=7.63, fv=28.9 | M/V/fv/uplift pass tolerance; two missing shown values |
| REK-07a/b/c ASD, pp. 19-51–19-53 | A1=50; A2=96.4/50/74.8; Abr=69.4/50/61.2 in² | all three layouts PASS tolerance |
| REK-08 ASD, pp. 19-54–19-71 | lb=5.5; Apt=95.0; Apv=91.4; Ab=.334; Ba=4,970; Bv=2,852; IR=.225 | not drivable at f'm=1,750; gross/threaded area conflict found |
| REK-09 ASD, pp. 19-71–19-75 | Rdown=17,378; Rup=5,216; Abr=69.4; fbr=250; Apt=133.7; Bab=6,991 | bearing PASS; Apt/Bab FAIL |

## Diagram audit summary

Every current diagram was judged against the fixture's checklist using freshly rendered SVG DOM metadata and the captured full-page screenshot. **0 of 10 calculators fully pass the professor-grade diagram checklist.** Every dimension actually drawn was checked against fixture/math; no contradictory dimension was found. Each fixture evidence JSON records its per-diagram missing elements and dimension judgment under `result.diagram.audit`.

## Traceability evidence

The report retains only a summary; the required granular tables are persisted in every per-fixture evidence JSON under `result.traceability`. They contain one row per output/conditional branch with: inputs, constants, equation, TMS cite, applicability limits, whether code enforces/states/is silent, and the shown-work element. Coverage includes:

- anchor embedment, projected areas, every tension/shear mode toggle, governing selection, and interaction;
- all three bearing layouts, bearing, breakout and steel uplift branches;
- lintel downward/uplift statics, shear, masonry/steel flexure, jamb cracked P+M, slender cap and deflection gate;
- reinforced/unreinforced wall axial, flexure, shear, combined, deflection and parapet branches;
- embed-plate Apt deductions, both load cases, interaction, bearing and plate branches.

## Per-calculator summary

| Calculator | Examples | Fixtures | CALC ERROR | HIDDEN VALUE | DIAGRAM | FLAG |
|---|---|---:|---:|---:|---:|---:|
| Headed anchor bolt | MDG 9.3-11 | 1 | 1 | 0 | 1 | 0 |
| Top-of-wall anchor | 9.3-2/10; REK-08 | 2 | 1 | 2 | 1 | 0 |
| Masonry ASD design | REK-04 | 1 | 0 | 1 | 1 | 0 |
| Bearing/uplift | REK-07a/b/c; REK-09 | 4 | 1 | 0 | 1 | 0 |
| Lap length | 9.2-1 | 1 | 0 | 0 | 1 | 0 |
| Lintel ASD | REK-06 | 1 | 0 | 1 | 1 | 0 |
| Lintel/jamb | REK-04; REK-06 | 2 | 0 | 1 | 1 | 0 |
| Reinforced wall ASD | REK-02–05 mapping | 1 | 0 | 0 | 1 | 1 |
| Unreinforced wall ASD | none matching | 1 | 0 | 0 | 1 | 1 |
| Embed plate | none matching combined model | 1 | 0 | 0 | 1 | 1 |

## Full proof output

```text
MASONRY AUDIT source=84af963 chrome=150.0.7871.114
Fixtures expected=15 calculators=10
EXECUTED masonry_lap_length/mdg-9.2-1
  PASS lap length: actual=ℓd = 19.50 expected=19.5
  PASS shown-work: 0.13: actual=present expected=visible text
  PASS shown-work: K: actual=present expected=visible text
  PASS shown-work: 12: actual=present expected=visible text
  PASS shown-value: K substitution: actual=present expected=5.625
  PASS shown-value: fm substitution: actual=present expected=2,000
  PASS shown-value: fy substitution: actual=present expected=60,000
  PASS shown-value: minimum: actual=present expected=12.00
EXECUTED masonry_anchor/mdg-9.3-2-10
  PASS tension capacity: actual=Ba,mas = 3.468 kips expected=3.47
  PASS OOP shear capacity: actual=Bv1 = 1.275 kips expected=1.27
  PASS shown-work: Apt: actual=present expected=visible text
  PASS shown-work: Apv: actual=present expected=visible text
  PASS shown-work: Eq 8-8: actual=present expected=visible text
  PASS shown-value: Apt: actual=present expected=62.05
  PASS shown-value: Apv: actual=present expected=22.80
  PASS shown-value: steel tension: actual=present expected=5.890
EXECUTED masonry_anchor/rek-08-asd
  PASS shown-work: Apt: actual=present expected=visible text
  PASS shown-work: Eq 8-8: actual=present expected=visible text
FINDING_MISMATCH masonry_anchor_bolt/mdg-9.3-11
  FAIL SD crushing: actual=Masonry Crushing (Eq.9-5) 3,495 lb φ=0.5, nom=6,990 lb expected=7180
  PASS shown-work: Eq. 9-5: actual=present expected=visible text
  PASS shown-work: Apt: actual=present expected=visible text
  PASS shown-work: Ab: actual=present expected=visible text
  PASS shown-value: threaded Ab: actual=present expected=0.127
  PASS shown-value: effective lb: actual=present expected=4.66
  PASS shown-value: nominal crushing actual: actual=present expected=6,990
EXECUTED masonry_asd_design/rek-04-asd-section
  PASS REK-04 shear stress: actual=fv = 7.90 psi expected=7.9
  PASS shown-value: M input: actual=present expected=45,685
  PASS shown-value: V input: actual=present expected=964
  PASS shown-value: b substitution: actual=present expected=32
  PASS shown-value: depth substitution: actual=present expected=7.625
EXECUTED masonry_bearing_uplift/rek-07a-asd
  PASS A1: actual=Actual bearing area, A1 50.00 expected=50
  PASS A2: actual=Expanded area, A2 96.27 expected=96.4
  PASS Abr: actual=Effective bearing area, Abr 69.38 expected=69.4
  PASS shown-work: A1: actual=present expected=visible text
  PASS shown-work: Abr: actual=present expected=visible text
  PASS shown-value: A1 substitution: actual=present expected=50.00
  PASS shown-value: A2 substitution: actual=present expected=96.27
  PASS shown-value: Abr substitution: actual=present expected=69.38
EXECUTED masonry_bearing_uplift/rek-07b-asd
  PASS Abr edge: actual=Effective bearing area, Abr 50.00 expected=50
  PASS shown-work: Abr: actual=present expected=visible text
  PASS shown-value: A1=A2: actual=present expected=50.00
EXECUTED masonry_bearing_uplift/rek-07c-asd
  PASS A2 stack: actual=Expanded area, A2 74.75 expected=74.8
  PASS Abr stack: actual=Effective bearing area, Abr 61.14 expected=61.2
  PASS shown-work: A1: actual=present expected=visible text
  PASS shown-work: Abr: actual=present expected=visible text
  PASS shown-value: limited spread: actual=present expected=0.75
  PASS shown-value: A2 substitution: actual=present expected=74.75
  PASS shown-value: Abr substitution: actual=present expected=61.14
FINDING_MISMATCH masonry_bearing_uplift/rek-09-asd
  PASS bearing stress: actual=250.48 psi Bearing Stress fbr expected=250
  PASS Abr: actual=Effective bearing area, Abr 69.38 expected=69.4
  FAIL Apt group: actual=Apt = 152.50 in expected=133.7
  FAIL breakout: actual=Bab = 7.97 k expected=6.991
  PASS shown-work: A1: actual=present expected=visible text
  PASS shown-work: Abr: actual=present expected=visible text
  PASS shown-work: Apt: actual=present expected=visible text
  PASS shown-value: Rdown: actual=present expected=17.38
  PASS shown-value: Rup: actual=present expected=5.22
  PASS shown-value: Fb: actual=present expected=577.50
  PASS shown-value: Apt substitution: actual=present expected=152.50
FINDING_MISMATCH masonry_lintel_asd/rek-06-asd
  PASS M down: actual=(53,755 lb-ft) expected=53771
  PASS V down: actual=11,468 lb V — Downward expected=11463
  PASS fv: actual=fv=28.91 psi expected=28.9
  PASS uplift M: actual=122,080 lb-in |M| expected=122125
  PASS shown-work: TMS: actual=present expected=visible text
  PASS shown-value: M in-lb: actual=present expected=645,056
  PASS shown-value: Fvm: actual=present expected=47.06
  FAIL shown-value: As required: actual=NOT FOUND expected=0.43
  FAIL shown-value: Ms: actual=NOT FOUND expected=687,572
  PASS shown-value: uplift V: actual=present expected=526
  PASS shown-value: uplift M in-lb: actual=present expected=122,080
FINDING_MISMATCH masonry_lintel_jamb/rek-04-asd
  FAIL REK-04 target M: actual=NOT FOUND expected=39775
  PASS shown-work: 8.3.4.2.2: actual=present expected=visible text
  PASS shown-work: 0.30: actual=present expected=visible text
  PASS shown-work: 0.6: actual=present expected=visible text
  PASS shown-value: P target: actual=present expected=15,026
  PASS shown-value: W jamb: actual=present expected=32
FINDING_MISMATCH masonry_lintel_jamb/rek-06-asd
  PASS M down: actual=53,755 lb·ft Max Gravity Moment expected=53771
  PASS V down: actual=v V = 11,468 lb expected=11463
  PASS shown-work: 8.3.4.2.2: actual=present expected=visible text
  PASS shown-work: 0.30: actual=present expected=visible text
  PASS shown-work: 0.6: actual=present expected=visible text
  FAIL shown-value: M in-lb: actual=NOT FOUND expected=645,251
  PASS shown-value: fv: actual=present expected=28.9
  PASS shown-value: uplift: actual=present expected=6,583
EXECUTED masonry_reinforced_wall_asd/rek-wall-default
  PASS shown-work: 8.3.2: actual=present expected=visible text
  PASS shown-work: 8.3.5.1.1: actual=present expected=visible text
EXECUTED unreinforced_cmu_wall_asd/default-smoke
  PASS shown-work: 8.2.4.3: actual=present expected=visible text
  PASS shown-work: 8.2.6.2: actual=present expected=visible text
EXECUTED embed_plate_beam_bearing/default-smoke
  PASS shown-work: Apt: actual=present expected=visible text
  PASS shown-work: 0.5: actual=present expected=visible text
  PASS shown-work: UNC: actual=present expected=visible text
AGGREGATE PASS executed=15/15 calculators=10/10 findings=7 harness_errors=0
```

`FINDING_MISMATCH` means the fixture executed and exposed a numerical or shown-value finding. It does not fail the pre-fix infrastructure gate. Only missing/incomplete fixtures, harness/page errors, or missing calculators make the process exit nonzero.

## Deviations from the frozen spec

1. The source PDFs remain unavailable. The prior whole-example “extraction unreadable” deviation is withdrawn: all named REK examples were recovered from text. Two individual printed inconsistencies remain for PDF verification below.
2. The in-app browser was unavailable (browser list empty). Live evaluation therefore used the deterministic runner's newly rendered SVG DOM plus its same-run Chrome screenshots, not a separate interactive browser session.
3. No calculator is approved/fixed, so evidence contains baseline screenshots only; after-screenshots belong to the gated fix phase.
4. Chrome console health uses page `error` capture plus fatal/uncaught stderr detection without adding a DevTools dependency.

## Could not verify

- **REK-06 p. 19-46/19-47, concentrated reaction:** introductory text prints 17,939 lb while the calculation and reviewer-confirmed benchmark use 17,390 lb. Verify that specific value against the PDF.
- **REK-06 p. 19-50, uplift neutral-axis substitution:** extracted text prints k=0.127 but a later kd line appears to reuse 0.183. Verify that specific substitution against the PDF.
- Full REK-04 P+M interaction in current UIs: blocking direct M/V/P inputs are absent; recorded as HIDDEN VALUE, not extraction failure.
- REK-08 exact run: f'm=1,750 psi is absent from the select; recorded as not drivable with printed values retained in JSON.
- Unreinforced wall and combined embed-plate model: no matching MDG worked example.

## Files added/changed

- `docs/masonry-audit-2026-07.md` — rewritten once, cleanly, with corrected findings and proof.
- `public/dev/audit-fixtures/fixtures.json` — expanded from 10 to 15 real benchmark/smoke fixtures.
- `public/dev/audit-proof-helper.js` — numeric regex/tolerance scraper, substituted-value assertions, diagram judgments, and traceability persistence.
- `public/dev/audit-masonry-asd-design-proof.html` — invokes the page's real calculate function.
- `tools/masonry-audit/build-fixtures.mjs` — reproducibly generates the expanded machine-readable fixtures.
- `tools/masonry-audit/build-report.mjs` — reproducibly writes this single clean report.
- `public/dev/audit-evidence/manifest.json` and `full-run.log` — regenerated aggregate evidence.
- `public/dev/audit-evidence/*.json` (15 files) — raw outputs, value assertions, branch traceability, diagram audit, environment.
- `public/dev/audit-evidence/*.png` (15 files) — same-run baseline screenshots.

Existing proof pages, decision register, runner, and product files are otherwise unchanged. No `refs/` input is listed as an added file.
