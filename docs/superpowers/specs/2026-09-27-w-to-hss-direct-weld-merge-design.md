# W-Beam Directly Welded to HSS Column — merged calculator design

Date: 2026-09-27. Author: Claude Fable 5.1 for Nick Rohr (ARE).
Source request: merge the three sidebar entries built on DG24 Example 4.3 into one
calculator, run every applicable AISC check instead of printing "NOT included", and
handle a beam flange wider than the HSS workable flat or wider than the HSS itself.
Handoff reviewed: `Documents/Codex/2026-09-23/based-on-the-dg24-steel-hss/outputs/W-to-HSS-direct-weld-calculation-update-handoff.md`.

## 1. What exists today (verified in the repo)

| Sidebar entry | File | Engine | Checks run | Problems |
|---|---|---|---|---|
| W-Beam to HSS Column (DG24 Ex 4.3) — slug `w-to-hss-column` | `public/Calcs/W_beam_to_HSS_column_calculator.html` (595 lines, vanilla) | inline `runCalc()` | flange fit on flat, limits, one local-yielding row | cites "Eq. K1-7" and "Table K1.3A" (both wrong in 360-22); banner "All Checks Pass"; fit ratio `bf/(B−3t)` counted as max D/C; φ = 0.95; notes say web yielding/crippling, welds, shear, column checks "NOT included" |
| Directly Welded W to HSS (React) — slug `directly-welded-hss` | `public/Calcs/directly_welded_HSS_connection_calculator.html` (1065 lines, React/Babel/Tailwind) | inline React | fit, limits, local yielding, punching when applicable | sidewall "REQUIRED — not computed by this tool"; hardcoded Fy 46/50; no Mu input (capacity only); fixed φ 0.95 |
| HSS Connection — Complete Checks (React) — slug `hss-connection-complete` | `public/Calcs/hss_connection_complete_calculator.html` (939 lines, React) | inline React | fit, limits, local yielding, punching, sidewall yielding (β = 1.0 only) | 37-shape hardcoded table; crippling "verify separately"; no welds, no Qf, no Mu input; "All applicable limit states checked" banner is false |

All three share `calcType: 'w-to-hss-column'` in `are-draw.js` (`renderWToHss`), whose caption also
says "Eq. K1-7". A saved project record exists:
`Technical Resources/Steel/Reference/26-003-KAALO - W-Beam Directly Welded to HSS Column - JST@ GLN6 LOW ROOF - 2026-09-23.html`
(`are.snapshot.v1`, `calcFile: W_beam_to_HSS_column_calculator.html`, fields `#wsec #Fyb #hsec #Fy #Mu`,
W16X57 / HSS10X10X1/2 / Mu = 60 kip-ft, reported φMn = 87.94 kip-ft).

## 2. Reference verification

| Ref | Claim in handoff | Verified? | Where / result |
|---|---|---|---|
| R1 DG24 1st ed (2010) §4.4, Ex 4.3 pp. 30, 46–48 | fit-on-flat step `bf ≤ B − 3t`; local yielding K1-2 (360-05/10 numbering), φ 0.95, Rn 70.8 k, φRn 67.3 k, φMn 88.1 kip-ft; punching skipped (bf < 0.85B); sidewall skipped (β ≠ 1.0) | **Yes** | local PDF `Technical Resources/Steel/Reference/AISC DESIGN GUIDE (DSG)/DG24-Hollow Structural Section Connections.pdf` is the **1st edition**; text matches. §7.1 p. 77 states the directly welded connection is "semi-rigid or partially restrained (PR)". Table 7-2 p. 80: punching when 0.85B ≤ Bp ≤ B − 2t; sidewall rows "when β = 1.0"; crippling K1-5 (φ 0.75) and buckling K1-6 (φ 0.90) carry Qf. |
| R2 DG24 2nd ed (2024) §6.4, Ex 6.3 pp. 124–125, 145–150 | flange wider than B permitted without trimming, credited width capped at B; PR classification | **Partly** | Not in Nick's library (AISC members download free at aisc.org/dg). STI review by Packer (July 2024, fetched) confirms: 2nd ed conforms to 360-22 + 16th Ed Manual, Chapter 6 covers the directly welded connection "which normally only qualifies as PR", Chapter 3 says kds may not be used for a single-sided fillet on a rectangular-HSS wall in tension, Chapter 8 tabulates six limit states for plate-to-rectangular HSS. Page numbers and the "no trimming" sentence are **unverified**. |
| R3/R4 AISC 360-22 §K1, K2.3, K5 | K1-1 = Be, K1-7 = end distance, K2.3 routes to Chapter J; no "Table K1.3A" | **Yes** | local PDF `AISC 2022/…a360-22w.pdf` pp. 16.1-159/160/171; Comm. K1/K2 pp. 16.1-529 to 531: branch width > 85% of chord → J10.2/J10.3/J10.5 sidewall limit states; < 85% → face bending and shear; yield-line φ = 1.00; WF-beam-to-HSS PR connections modeled as two transverse plates. |
| R5 Steel Interchange Jan 2014 | β = 1 cap, flange wider than HSS, effective weld width, fatigue caveat | **No** | AISC now redirects the PDF URL to its archive index; studylib mirror returns 403. Treat as unverified; the β ≤ 1.0 cap follows directly from the 360-22 K1.1 definition and limits (0.25 ≤ β ≤ 1.0), so the calculator does not depend on this reference. |
| R6 STI "Welding in HSS Corners" (2022) | flare-bevel groove at corners, throat per Table J2.2, R = 2t when unknown, root gap limits | **Yes** (fetched) | Effective throat from 360-22 Table J2.2 (flare-bevel: 5/16 R SMAW/FCAW-S/SAW, 5/8 R GMAW/FCAW-G; note: R < 3/8 in → use only the reinforcing fillet); R assumed 2t; welds must be filled flush or throat reduced by underfill. |
| R7 STI "HSS Moment Connection Design Examples: Transverse Flange Plates" (July 2025) | current-edition workflow | **Yes** (fetched) | HSS12x8x1/2 A500C, PL 3/8 × 6½, cross-connection, Pu 500 k, Mu 45 kip-ft. Published values reproduced by this design's formulas: Be 4.68 in; plate local yielding φRn 79.1 k (φ 0.90, J4-1); face plastification φRn 96.7 k (φ 1.00, Manual Part 9 yield line with Qf 0.918); punching 115.9 k; sidewall yielding 179.6 k (tw = 2t); weld le = 2Be = 9.37 in, φRn 52.2 k (¼ in fillet, no kds). |
| R8 STI "Wide-Flange Beam to HSS Column Moment Connections" (Ericksen, Oct 2014) | load path face → sidewalls, keep flat/bf ratio near 1 | **Yes** (fetched PDF) | Confirms; no equations. |
| SEU Jan 2014 (Olson) directly welded example | HSS8x8x3/8 A1085 + W16x36, Mu 66 kip-ft | **Yes** (fetched PDF) | φRn local yielding 58.4 k, punching applicable, Bep 3.28 in, φRn 79.3 k (φ 0.95, 360-10). Reproduced (79.2 k). |

## 3. Decisions

1. **One calculator, one file, same URL.** Rewrite `W_beam_to_HSS_column_calculator.html` in place (slug `w-to-hss-column`, sidebar label "W-Beam Directly Welded to HSS Column"). Keep input ids `wsec, Fyb, hsec, Fy, Mu` so the 26-003 saved record still hydrates. Delete the two React files and their registry entries; add permanent redirects `/calcs/directly-welded-hss` and `/calcs/hss-connection-complete` → `/calcs/w-to-hss-column`.
2. **Pattern = flange-plated calc** (`flange_plated_HSS_column_moment_connection_calculator.html`, deployed 2026-09-22): vanilla JS, DOM-free engine `window.DWHSS.compute(inp)`, `runFixtures()`, `?selftest=1`, Playwright harness `tools/test-w-to-hss.mjs`, `npm run test:wthss` chained into `npm run qa`, embedded W_DB (W8–W36) and HSS_DB (4–20 in) copied verbatim from that file, plus a "custom" entry for each.
3. **Code basis select**: `AISC 360-22 / DG24 2nd ed` (default) or `DG24 1st ed / AISC 360-10 (legacy φ)`. Only φ differs. The legacy mode reproduces 87.9 kip-ft for the 26-003 record; the default gives 83.3 kip-ft (φ 0.90 on flange local yielding through Be).
4. **Flange width handling** (handoff §2.A): credited width `bfc = min(bf, B)`, `β = bfc/B`. Classification row, never a strength D/C: `flat` (bf ≤ B − 3t), `corner` (B − 3t < bf ≤ B, overlap per side reported), `beyond` (bf > B, projection per side reported, REVIEW). Welds through the corner region are credited only as flare-bevel groove welds with throat from Table J2.2 (R = 2t; none if R < 3/8 in).
5. **Every limit state is computed and shown** with its own applicability. Rows outside their applicability band still display φRn and D/C but as INFO (excluded from the governing D/C) with the reason. Nothing prints "not computed by this tool".
6. **Banner honesty**: PASS / REVIEW / FAIL from strength rows; REVIEW when any geometry/detail/limit item needs the engineer (flange beyond B, corner weld not permitted, limits of applicability violated, fillet size outside J2.2b). Beam-web shear connection and rotational stiffness are permanent INFO rows, and the banner subtitle says "flange-couple checks; web shear connection and frame stiffness are separate".
7. **Default weld = CJP groove** (develops the flange; weld rows N/A with note). Fillet option: size, faces (top face only | both faces), process (SMAW/FCAW-S/SAW | GMAW/FCAW-G, for the flare-bevel throat), FEXX, kds checkbox permitted only with both faces.
8. **Commit locally, do not push.** Nick reviews before deploy.

## 4. Engine

### 4.1 Input (`inp`), all inches / kips / ksi / kip-ft
```
{ code:'360-22'|'dg24-1',
  beam:{label,d,bf,tf,tw,Fy,Fu,Zx},            // Zx for the informational beam φbMpx row
  Mu, Vu,                                      // Vu informational only
  col:{label,H,B,t,A,S,Fy,Fu,Pu,Mu},            // t = design wall thickness; Pu, Mu = column required strengths for Qf
  connType:'T'|'X',                            // beam one side | beams both sides
  lend:null|number,                            // distance flange to unreinforced column end; null = adequate / continuous
  weld:{type:'cjp'|'fillet', w, faces:1|2, proc:'smaw'|'gmaw', Fexx, kds:bool} }
```
Validation (error box, no results): all dimensions/strengths positive; `B > 3t`, `H > 3t`; `bf > 0`; fillet `w > 0` when type fillet; `Mu > 0`; `Pu, Mu_col, Vu ≥ 0`; `lend ≥ 0` when given.

### 4.2 Derived quantities
```
flat = B − 3t;  bfc = min(bf, B);  β = bfc/B
overlap = max(0, min(bf,B) − flat)/2 per side;  proj = max(0, bf − B)/2 per side
cls = bf ≤ flat ? 'flat' : bf ≤ B ? 'corner' : 'beyond'
lever = d − tf;  Puf = 12·Mu/lever                    (DG24 Ex 4.3, Comm. K2)
B/t, H/t, k = 1.5t (outside corner radius, DG24 Table 7-2), η = tf/B
Be  = min( (10/(B/t))·(Fy·t/(Fyb·tf))·bfc , bfc )      (360-22 Eq. K1-1)
Bep = min( (10/(B/t))·bfc , bfc )                      (Eq. K1-2)
U   = Pu/(Fy·A) + 12·Mu_col/(Fy·S)                     (Eq. K1-6, side with higher compression)
Qf  = 1.0 if U ≤ 0 (face in tension) else clamp(1.3 − 0.4·U/β, 0.4, 1.0)   (Eq. K1-4)
endRed = 0.5 if (lend given, β ≤ 0.85, lend < B(1−β)) else 1.0             (Eq. K1-7, §K1.4)
```
U > 1.0 exceeds the Eq. K1-6 limit on column utilization: the QF row goes REVIEW with the note "U > 1.0: column utilization exceeds Eq. K1-6 limit; check the column member" (row stays informational). U = 0 is reported as "no chord load → Qf = 1.0".

### 4.3 Resistance factors by code mode
| id | Limit state | 360-22 (default) | dg24-1 (legacy) | 360-22 citation |
|---|---|---|---|---|
| LY | Flange local yielding through Be, `Rn = Fyb·tf·Be` (≤ Fyb·tf·bfc) | 0.90 | 0.95 | §K1.2a Eq. K1-1, §K2.3 → §J4.1 Eq. J4-1 (tension) / §J4.4 Eq. J4-6 (compression); Comm. Table C-K1.1 |
| PL | HSS face plastification, `Rn = Fy·t²·[2η/(1−β) + 4/√(1−β)]·Qf`, applies β ≤ 0.85 | 1.00 | 1.00 (not in DG24 1st ed Table 7-2; note this) | §J10.10 / Comm. K1 yield line, 16th Ed Manual Part 9 (form of 360-10 Eq. K2-7); STI 2025 |
| PS | HSS shear yielding (punching), `Rn = 0.6·Fy·t·(2tf + 2Bep)`, applies 0.85B ≤ bfc ≤ B − 2t | 1.00 | 0.95 | §K1.2a Eq. K1-2, §J4.2(a) Eq. J4-3 on the effective perimeter; Comm. Table C-K1.1 |
| SY | Sidewall local yielding, `Rn = 2·Fy·t·(5k + tf)`, applies β ≥ 0.85 | 1.00 | 1.00 | §J10.2 Eq. J10-2 on two walls, Comm. K2 |
| SC | Sidewall local crippling (T, compression flange), `Rn = 1.6·t²·[1 + 3tf/(H−3t)]·√(E·Fy)·Qf`, applies β ≥ 0.85 | 0.75 | 0.75 | §J10.3 Eq. J10-4 two walls (DG24 K1-5 form) |
| SB | Sidewall local buckling (X, compression flange), `Rn = 48·t³/(H−3t)·√(E·Fy)·Qf`, applies β ≥ 0.85 | 0.90 | 0.90 | §J10.5 Eq. J10-8 two walls (DG24 K1-6 form) |
| W  | Flange-to-HSS fillet welds (below) | 0.75 | 0.75 | §J2.4, §K5 Table K5.1 Eq. K5-4 |

`endRed` multiplies LY, PL, PS, SY, SC/SB. Qf applies only to PL, SC, SB (DG24 Table 7-2; 360-22 K1.3 "where required").
Tension and compression flanges are checked separately: LY, PL, PS, SY for both; SC or SB for the compression flange only. E = 29000 ksi.

### 4.4 Welds (type fillet)
```
R = 2t (Table J2.2 note for HSS);  Ecor = R ≥ 0.375 ? (proc==='gmaw' ? 5/8 : 5/16)·R : 0
Lflat = min(bfc, flat);  Lcor = bfc − Lflat                (per face, both corners together)
Lcor_e = min(Lcor, Be);  Lflat_e = Be − Lcor_e            (effective length allocated from the flange edges inward, K5-4: le = 2Be for two faces)
kds = (kds checked && faces === 2) ? 1.5 : 1.0             (DG24 2nd ed Ch. 3: no kds for a single-sided fillet in tension; J2.4(a)(3))
Rn = faces · 0.6·Fexx · (0.707·w·Lflat_e + Ecor·Lcor_e) · kds;   φRn,wm = 0.75·Rn   (weld metal)
φRn,bmH = 0.75·0.6·Fu·t·le         (HSS wall shear rupture; each weld line loads its own wall strip, le = faces·Be)
φRn,bmF = 0.75·0.6·Fub·tf·Be       (flange shear rupture; one thickness carries both faces, does not scale with faces)
φRn (W row) = min(φRn,wm, φRn,bmH, φRn,bmF)      (Manual Part 9 base metal cap)
```
Base-metal cap: Manual Eq. 9-2/9-3 are derived from the base-metal shear rupture strengths above, so the W row carries the cap directly (`vals.weld.phiWm`, `phiBmH`, `phiBmF`, `phiW`; the detail names the governing one) and the tmin rows do not enter max D/C / φMn.
Rows: W (strength, capped as above), WBH `tmin = 3.09·D/Fu ≤ t` (Manual Eq. 9-2, D = 16w), WBF `tmin = (faces===2 ? 6.19 : 3.09)·D/Fub ≤ tf` (Eq. 9-3 / 9-2) — WBH/WBF are informational (D/C shown; PASS when tmin ≤ t, else INFO "base metal governs the weld row (capped)"), WLIM fillet limits (Table J2.4 min by thinner part min(tf, t); §J2.2b(b) max along the flange-end edge = tf − 1/16 (tf ≥ 1/4) else tf; length ≥ 4w). If `Lcor > 0` and `Ecor === 0`: status REVIEW "corner region not credited; R < 3/8 in".
Type CJP: W row INFO (flat) / REVIEW (corner or beyond) with note "CJP groove weld develops the flange; flange local yielding through Be governs the weld line". If `cls !== 'flat'`: REVIEW note "CJP through the HSS corner radius is not a prequalified detail; specify the corner joint preparation".

### 4.5 Informational rows (no D/C in the maximum)
- GEO geometry classification with flat, overlap, projection, bfc, β. Status INFO (flat), REVIEW (corner: "corner-region weld detail required"), REVIEW (beyond: "flange projects past B; credited width capped at B, β = 1.0").
- LIM limits of applicability (§K1.3 · DG24 Table 7-2A): B/t ≤ 35, H/t ≤ 35, 0.25 ≤ β ≤ 1.0, Fy ≤ 52, Fy/Fu ≤ 0.8 (§K1.3); Fyb ≤ 52, Fyb/Fub ≤ 0.8 (DG24 Table 7-2A transverse-plate material limits). A500 Gr C exemption (§K1.3 note): Fy 50 / Fu 62 (ratio 0.806) passes the Fy/Fu line with the text "A500 Gr C, acceptable per §K1.3 note" (same pattern for the beam ratio if Fyb 50 / Fub 62). PASS/REVIEW.
- END end distance (§K1.4 Eq. K1-7): `lend ≥ B(1−β)` for β ≤ 0.85; INFO "column continuous/adequate" when null; REVIEW with "50 % reduction applied" when violated.
- QF chord-stress interaction values U, Qf (INFO; REVIEW when U > 1.0, §4.2).
- STIFF rotational stiffness: "Partially restrained (PR) — DG24 1st ed §7.1, 2nd ed Ch. 6; FR stiffness not verified by this calculator" (INFO).
- SHEAR beam web shear connection: "Vu = … designed separately (single-plate shear tab to the HSS wall, Manual Part 10)" (INFO).
- CAP connection φMn = Mu/maxDC vs beam φbMpx = 0.90·Fyb·Zx/12, ratio shown (INFO). Fatigue/seismic note in the notes box only.

### 4.6 Result
`{ok, errors, checks[], vals, maxDC, governing, governingId, banner:'PASS'|'REVIEW'|'FAIL'}` exactly as FPHSS; `vals.phiMn = Mu/maxDC`.

## 5. Fixtures (engine `runFixtures()`; tolerances in the plan)
| id | Source | Key expectations |
|---|---|---|
| F1 | DG24 1st ed Ex 4.3, legacy mode, W16X57 / HSS10X10X1/2 / Mu 60, CJP | flat 8.605, cls flat, Be 1.981, RnLY 70.82, φRnLY 67.28, PS N/A (bfc < 8.5), SY/SC INFO (β 0.712), φMn 87.94 (legacy ratio Mu/maxDC) |
| F2 | same, 360-22 mode, Pu 600 (1.2·100 + 1.6·300 from the example's column loads), fillet 5/16 one face E70 | φRnLY 63.74; U 0.7583, Qf 0.874, φRnPL 69.11 (applicable, not governing); weld le = Be 1.981, φRnW 13.79 governs (D/C 3.33) — demonstrates the DG24 lesson; tminHSS 0.266 |
| F3 | Handoff 6-in case: custom HSS B=H=6, t 0.465, A 9.74, S 16.1, Fy 46; custom beam d 12, bf 5.5, tf 0.5, tw 0.3; Mu 40; fillet 5/16 one face | flat 4.605, cls corner, overlap 0.4475/side, β 0.9167, PS N/A (5.5 > B−2t 5.07), PL N/A (β > 0.85), SY/SC applicable, Ecor 0.2906 (R 0.93), Lcor 0.895, no FAIL from geometry, banner REVIEW |
| F4 | W16X57 on the 6-in HSS, Mu 40, fillet | cls beyond, bfc 6, β 1.0, proj 0.56/side, Be 2.782, REVIEW |
| F5 | STI July 2025 (HSS12x8x1/2 B 8 H 12 t 0.465 A 17.2 S 55.6 Fy 50 Fu 62; custom beam bf 6.5 tf 0.375 d 18 Fyb 50; Pu 500, Mu_col 45; X; Mu = 46.7·17.625/12; fillet ¼ both faces, no kds) | Be 4.685, φRnLY 79.06, U 0.7756, Qf 0.918, φRnPL 96.66, RnPS 115.87, RnSY 179.6 (INFO, β 0.8125), le 9.37, weld metal φRn 52.17, flange base metal φRn 51.37 → W row 51.37 governs (D/C 0.909), WBF INFO, LIM PASS (Gr C exempt), banner PASS |
| F6 | SEU Jan 2014 (custom HSS 8×8, t 0.375, Fy 50 Fu 65; W16X36 d 15.9 bf 6.99 tf 0.43; Mu 66; legacy; CJP) | Puf 51.2, φRnLY 58.36, PS applicable, Bep 3.277, φRnPS 79.23 |
| F7 | validation: beam bf 0, fillet w 0, B ≤ 3t | ok false with messages |
| F8 | F1 in 360-22 with lend 1.0 | endRed 0.5, φRnLY 31.87, END row REVIEW |
| F9 | F1 in 360-22 with Pu 1000 (CJP) | U = 1000/(46·17.2) = 1.264 > 1.0 → QF row REVIEW, banner REVIEW |

## 6. UI (FPHSS layout)
Header tags: AISC 360-22 Ch. J & K · DG24 1st ed Ex 4.3 · DG24 2nd ed Ch. 6 · STI 2025.
Inputs: 0 Code basis · 1 Beam (select + custom fields d, bf, tf, tw, Zx; Fyb, Fub) · 2 HSS column (select + custom H, B, t, A, S; grade select A500 Gr B 46/58 | A500 Gr C 50/62 | A1085 50/65 | custom; Pu, Mu_col; connection T/X; lend blank = adequate) · 3 Demands (Mu, Vu) · 4 Weld (type, size, faces, process, FEXX, kds).
Results: banner (PASS/REVIEW/FAIL, max D/C, governing row, φMn, subtitle about separate items) · error box · cards (Puf, β, flat, overlap/projection, Be, Bep, Qf, φMn) · classification callout · check table with sections Geometry & applicability | Tension flange | Compression flange | Welds | Design status · notes box (references, edition mapping, PR statement, fatigue/seismic, web shear separate).
Schematic: `AREDraw.renderConnection(svg, state)` with `state.connection.weldSize`, `state.connection.caption`, `state.connection.geometry = {flat, overlap, proj, cls}`.
Print/save: standard are-utils-v2 field snapshot; mark field via `AREv2.getMarkHTML()`.

## 7. are-draw.js `renderWToHss`
Caption from `state.connection.caption` (default "AISC 360-22 Ch. J/K · DG24 — directly welded flange couple"); weld label from `state.connection.weldSize` (default 'FW'); section view adds the flat-width dimension `B − 3t` and, when `geometry.overlap > 0`, hatches the corner overlap bands; when `geometry.proj > 0`, draws the flange projection beyond B dashed with a "not credited" label.

## 8. Retirement and docs
Delete the two React calcs; remove their `CALCS` entries; drop them from `HSS_FAMILY`/`CALC_SLUG_MAP` and rewrite the chooser text (one directly welded entry); redirects in `next.config.ts`; regenerate `tools/calc-coverage.csv` (`node tools/derive-coverage.mjs --write`); fix `docs/calc-state-spec.md` line 27 citation; copy the new file to `RE CODING/Steel/W_beam_to_HSS_column_calculator.html`; hand-check record `docs/w-to-hss-direct-weld-hand-check-2026-09.md`.

## 9. Out of scope
Beam-web shear tab design, FR stiffness calculation, fatigue/seismic qualification, HSS column member flexure, through-plate/flange-plated alternatives (separate calcs).
