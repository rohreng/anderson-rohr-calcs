# Dowelled Embed Plate — Tension Dowel Development — Design Spec

*Anderson Rohr Engineering · 2026-09-27 · TMS 402-22 §6.1.6.3.1 (Eq. 6-2), §8.3.3.1 (ASD), §9.1.4 (SD) · MDG 2022 Example REK-09 §5*

## 1. Purpose

One ARE web calculator for the MDG 2022 "Dowelled Embed Plate Alternate" (Example REK-09, ASD printed p. 19-76 / SD p. 19-145): a steel plate bearing on a grouted CMU wall, anchored for tension by weldable deformed bars welded to the plate and embedded in the grouted cells. It answers two questions for full tension development of the dowels:

1. Do the dowels carry the applied tension T? (ASD `T_all = n·A_s·F_s`; SD `φT_n = 0.90·n·A_s·f_y`)
2. Are the dowels fully developed in the embedment provided? (`l_d` per Eq. 6-2 with `K = min(cover, clear spacing, 9d_b)`, `l_d ≥ 12 in`, ×1.5 epoxy) vs. embedment `L_e`.

No proportional reduction of `l_d` for excess reinforcement: TMS 402-22 has none, and the ask is full development.

Basis documents on this machine (verified by text extraction 2026-09-27):
- `Technical Resources - Documents/Masonry/TMS-402-602-22.pdf` — §6.1.6.3.1 (PDF p. 96; epoxy commentary p. 97), Table CC-6.1.3 (p. 89), §6.1.7.3.1 (p. 101), §8.3.3.1 (p. 148), Table 9.1.4 (p. 157).
- `Technical Resources - Documents/Masonry/Masonry-Designers-Guide-2022_2023-09-26.pdf` — REK-09 ASD §5 (PDF p. 745), REK-09 SD §5 (PDF p. 814), REK-10 (PDF p. 746).
- Same PDFs plus `tms_full.txt` / `designers_guide.txt` in `RE CODING/Masonry/`.

## 2. Files and registration

| Item | Value |
|---|---|
| Calc file | `public/Calcs/masonry_dowelled_embed_plate_calculator.html` |
| Engine | DOM-free `window.MDEP` (`compute`, `validate`, `runFixtures`, `FIXTURES`, `BASE`, `merge`) in its own `<script>` block ahead of the UI script |
| `app/lib/calcs.ts` entry | slug `masonry-dowelled-embed-plate`, label "Dowelled Embed Plate — Tension Dowels", category `Masonry`, group `CMU Connections`, material `Masonry`, calcType `Anchors & Development`, spec `TMS 402-22 §6.1.6.3.1 / MDG REK-09`, status `ready`, icon `anchor-masonry`, inserted directly after `embed-plate-beam-bearing` |
| Node test | `tools/test-dowelled-embed-plate.mjs`, wired as `npm run test:mdep` and appended to `npm run qa` |
| Hand-check note | `docs/dowelled-embed-plate-hand-check-2026-09.md` |
| Coverage manifest | regenerate `tools/calc-coverage.csv` with `node tools/derive-coverage.mjs --write`; `tools/qa-report.md` rewritten by `npm run qa` |
| Nick's folder copy | `RE CODING/Masonry/masonry_dowelled_embed_plate_calculator.html` |

Template: `public/Calcs/W_beam_to_HSS_column_calculator.html` (inline CSS lines 1–94, helpers `f1..f4/fr/ov` 230–236, engine `mk/H/R/I/V/SEP/DC/END` 801–823, `validate/compute/FIXTURES/runFixtures` 825–1102, UI 1106–1330, `<script src="/are-draw.js">` + `<script src="/are-utils-v2.js" data-no-theme>` last). Static inputs with unique ids only; no adapter, no dynamic rows. Bar table, γ function and unit-thickness / face-shell maps copied from `masonry_lap_length_calculator.html` lines 334–358 and 347–351.

## 3. Inputs

Units: lengths in, forces lb, stresses psi (MDG convention; matches the other masonry calcs). Defaults in brackets reproduce MDG REK-09 ASD so the page opens on the verified case.

### 3.1 Code basis
- `code`: `asd` | `sd` [`asd`]. Labels "ASD (TMS 402-22 Ch. 8)" / "Strength Design (TMS 402-22 Ch. 9)". Changes only the bar-tension check and the demand label (T vs T_u).

### 3.2 Demand
- `T` applied tension on the plate, lb [5216] — from the connection analysis (ASD combination or factored). Zero allowed (development-only use).

### 3.3 Wall and masonry
- `cmu` nominal thickness select 4 | 6 | 8 | 10 | 12 | 16 → `t = {3.625, 5.625, 7.625, 9.625, 11.625, 15.625}` [8]
- `fm` specified f'm, psi [1750]
- `barPos`: `center` | `custom` [`center`]. Center: `cover = t/2 − d_b/2`. Custom exposes `coverIn` (masonry cover to the bar surface, in) for bars offset in the cell.
- `epoxy` checkbox [off] — ×1.5 on the Eq. 6-2 result only, not on the 12 in minimum (§6.1.6.3.1 and its commentary).

### 3.4 Dowels
- `bar` size #3–#11 [#4]; `d_b`, `A_s` from Table CC-6.1.3: `{3:[0.375,0.11], 4:[0.500,0.20], 5:[0.625,0.31], 6:[0.750,0.44], 7:[0.875,0.60], 8:[1.000,0.79], 9:[1.128,1.00], 10:[1.270,1.27], 11:[1.410,1.56]}`
- `grade` 40 | 60 [60] → `f_y = 40000 | 60000`; ASD `F_s = 20000 | 32000` (§8.3.3.1). Grade 40 and 50 share 20,000 psi; offer 40 and 60 only.
- `n` number of dowels [2], integer ≥ 1
- `s` dowel spacing o.c. along the plate, in [3] — used only when `n ≥ 2`; `clear = s − d_b`
- `Le` embedment below the plate (bar length in grout), in [24]
- `weldable`: `a706` | `ce` (chemical analysis / carbon-equivalent submittal) [`a706`] — feeds the weld note row only.

### 3.5 Plate (drawing and detailing only)
- `Lp` plate length along the wall, in [10]; `Bp` plate width across the wall, in [7.625]; `tp` thickness, in [0.5].
- Dowel group centered on the plate: end distance `e_p = (Lp − (n−1)·s)/2`. The MDG layout is 3½ + 3 + 3½ = 10 in. If `e_p < d_b` → validation error ("dowels do not fit on the plate"). No plate flexure check (§8).
- `Fyp` plate yield strength, psi [36000] and `Fup` plate tensile strength, psi [58000] (A36) — plate base-metal shear yielding / rupture at the weld.

### 3.6 Bar-to-plate weld (AISC 360-22 §J2, added 2026-09-27 at Nick's request)
- `weldCfg`: `fillet` | `flare` [`fillet`].
  - `fillet`: bar perpendicular to the plate (through a hole or butted to the underside), fillet weld all around the bar. Weld length `L_w = π·d_b`.
  - `flare`: bar laid against the plate face, flare-bevel-groove welds both sides of the bar over a length `Lw` each side (AISC Table J2.2).
- `w` fillet leg size, in [0.25] — the all-around fillet for `fillet`; the reinforcing fillet for `flare` when Table J2.2 note [a] applies.
- `Lw` flare weld length per side, in [4] — shown only for `flare`.
- `proc`: `gmaw` (GMAW / FCAW-G) | `smaw` (SMAW / FCAW-S) | `saw` [`smaw`] — shown only for `flare`; selects the Table J2.2 throat factor.
- `Fexx` filler metal classification strength, psi [70000].
- Weld demand: `T/n` per bar. The bar material side is not checked separately: A706 Gr 60 has `F_u = 80 ksi` above the weld metal, so weld metal governs (stated in the notes).

## 4. Engine

### 4.1 Derived
```
t      = T_MAP[cmu]
db, As = BAR[bar]
fy     = grade === 40 ? 40000 : 60000
Fs     = grade === 40 ? 20000 : 32000            // ASD §8.3.3.1
gamma  = bar <= 5 ? 1.0 : bar <= 7 ? 1.3 : 1.5   // §6.1.6.3.1
cover  = barPos === 'center' ? t/2 - db/2 : coverIn
clear  = n >= 2 ? s - db : null
nineDb = 9*db
K      = min(cover, clear (only when n >= 2), nineDb)   // §6.1.6.3.1 "K shall not exceed the smallest of"
ld_eq  = 0.13*db^2*fy*gamma / (K*sqrt(fm))        // Eq. 6-2
ld_ep  = epoxy ? 1.5*ld_eq : ld_eq
ld     = max(ld_ep, 12)                            // "shall not be less than 12 in."
Tcap   = code === 'asd' ? n*As*Fs : 0.90*n*As*fy
ep     = (Lp - (n-1)*s)/2

// --- bar-to-plate weld, AISC 360-22 §J2.4, Table J2.5: Fnw = 0.60*Fexx; φ = 0.75, Ω = 2.00
Tbar   = T / n
R      = db/2                                       // Table J2.2 "radius of joint surface"
if weldCfg === 'fillet':
  Lwt  = π*db                                       // all-around
  te   = 0.707*w                                    // §J2.2a effective throat
  Awe  = te*Lwt
  Rnw  = 0.60*Fexx*Awe                              // Eq. J2-4 with kds = 1.0 (conservative)
if weldCfg === 'flare':
  Lwt  = 2*Lw
  fac  = proc === 'gmaw' ? 5/8 : 5/16               // Table J2.2 flare-bevel-groove; smaw and saw both 5/16
  noteA = R < 0.375                                 // Table J2.2 note [a]: d_b < 3/4 in → #3–#5
  te   = noteA ? 0.707*w : fac*R                    // note [a]: "use only reinforcing fillet weld on filled flush joint"
  Awe  = te*Lwt
  Rnw  = 0.60*Fexx*Awe                              // Eq. J2-3
Rcap_w = code === 'asd' ? Rnw/2.00 : 0.75*Rnw
RnBMy  = 0.60*Fyp*tp*Lwt                            // plate shear yielding, §J4.2 Eq. J4-3 (Agv = tp·Lwt); φ = 1.00, Ω = 1.50
RnBMr  = 0.60*Fup*tp*Lwt                            // plate shear rupture, §J4.2 Eq. J4-4 (Anv = tp·Lwt); φ = 0.75, Ω = 2.00
Rcap_bm= min(code === 'asd' ? RnBMy/1.50 : 1.00*RnBMy, code === 'asd' ? RnBMr/2.00 : 0.75*RnBMr); bmGov = 'yield' | 'rupture'
wmin   = Table J2.4 on thinner part min(tp, db): ≤0.25 → 0.125; ≤0.5 → 0.1875; ≤0.75 → 0.25; else 0.3125
wminApplies = !(weldCfg === 'flare' && noteA)          // §J2.2b(a): Table J2.4 does not apply to fillet reinforcement of groove welds
TbarCap= code === 'asd' ? As*Fs : 0.90*As*fy        // per-bar dowel capacity, for the "weld develops the dowel" row
```
`K` uses the clear spacing between the dowels exactly as the MDG does (ASD and SD versions), even though the code phrase is "clear perpendicular spacing between adjacent reinforcement splices". The K detail panel carries one line: "MDG REK-09 applies the dowel clear spacing to K (conservative)."

### 4.2 Checks (in table order)

| id | Section | Name | Ref | Demand | Capacity | D/C |
|---|---|---|---|---|---|---|
| `tens` | Dowel tension | ASD `T ≤ T_all = n·A_s·F_s`; SD `T_u ≤ φT_n = 0.90·n·A_s·f_y` | `TMS 402-22 §8.3.3.1` / `TMS 402-22 Table 9.1.4 (φ = 0.90)` | T | T_all or φT_n | T / Tcap (T = 0 → 0.000, note "development-only") |
| `dev` | Development | `l_d ≤ L_e` | `TMS 402-22 §6.1.6.3.1 Eq. 6-2` | `l_d` (panel shows K, γ, √f'm, Eq. 6-2 result, epoxy factor, 12 in floor) | `L_e` | `l_d / L_e` |
| `kfac` | Development | K governing term | `TMS 402-22 §6.1.6.3.1` | — | — | INFO row listing cover / clear / 9d_b and which governs |
| `spc` | Placement | clear spacing ≥ max(d_b, 1 in) | `TMS 402-22 §6.1.4.1` | max(d_b, 1) | clear | max(d_b,1)/clear; N/A when n = 1 |
| `grt` | Placement | d_b ≤ ⅓ least grout-space dimension | `TMS 402-22 §6.1.3.2.4` | d_b | (t − 2·t_fs)/3, `t_fs` face shell per the lap calc `tfsMap` (4 in: 0.75; 6 in: 1.0; 8/10/12/16 in: 1.25) | d_b / cap |
| `fit` | Plate | dowels fit the plate, `e_p ≥ 1.5·d_b` | detailing | 1.5·d_b | e_p | REVIEW when e_p < 1.5·d_b (hard error below d_b); otherwise INFO |
| `wmet` | Bar-to-plate weld | Weld metal, per bar: fillet all-around `0.60·F_EXX·0.707·w·π·d_b` or flare-bevel `0.60·F_EXX·t_e·2·L_w` | `AISC 360-22 §J2.4 Eq. J2-4 / J2-3, Table J2.5` (flare: `Table J2.2`) | `T/n` | `R_nw/Ω` or `φR_nw` | Tbar / Rcap_w. Panel shows `L_w`, `t_e` (and the Table J2.2 factor, R, and the note [a] substitution when it applies), `A_we`, φ or Ω |
| `wbm` | Bar-to-plate weld | Plate base metal at the weld: lesser of shear yielding `0.60·F_yp·t_p·L_wt` (φ 1.00 / Ω 1.50) and shear rupture `0.60·F_up·t_p·L_wt` (φ 0.75 / Ω 2.00) | `AISC 360-22 §J4.2 Eqs. J4-3, J4-4` | `T/n` | governing `Rcap_bm` (panel shows both, governing bold) | Tbar / Rcap_bm |
| `wmin` | Bar-to-plate weld | Minimum fillet size `w ≥ w_min` (thinner part `min(t_p, d_b)`) | `AISC 360-22 Table J2.4` | w_min | w | w_min / w for `fillet`; for `flare` the row is INFO (`informational: true`, D/C null): when note [a] applies the note says "§J2.2b(a): minimum size does not apply to fillet reinforcement of groove welds", otherwise "no fillet in this configuration" |
| `wdev` | Bar-to-plate weld | Weld develops the dowel: `Rcap_w ≥ TbarCap` | `TMS 402-22 §6.1.7.3.1 (by analogy)` | TbarCap | Rcap_w | INFO row (`informational: true`), status "YES" / "NO" text in the note; never in the banner. Panel states that the weld should not govern over the dowel when full development is intended |
| `wreq` | Bar-to-plate weld | Weldability: bars ASTM A706 or CE submittal; welding per AWS D1.4/D1.4M | `TMS 402-22 §6.1.7.3.1, TMS 602-22 Art. 3.4 B.7` | — | — | NOTE row, `informational: true`; text reflects the `weldable` select |
| `tie` | Load path | Vertical reinforcement in the adjacent cell(s), lapped to the dowels, carries T to the foundation | `MDG REK-09 §5, REK-10` | — | — | INFO row; text links to `masonry_lap_length_calculator.html` for the dowel-to-vertical lap |

`maxDC` over `tens`, `dev`, `spc`, `grt`, `wmet`, `wbm`, and `wmin` (only when it is a D/C row, i.e. `fillet`). Banner: FAIL if any of those > 1.0; else REVIEW if `fit` is REVIEW; else PASS. The `wdev`, `wreq` and `tie` rows never affect the banner. When `T = 0` the three weld D/C rows read 0.000 and the `wdev` row still reports.

### 4.3 Validation (errors block compute)
- `T ≥ 0`, `fm > 0`, `Le > 0`, `n ≥ 1` integer, `s > d_b` when `n ≥ 2`, `coverIn > 0` when custom, `Lp > 0`, `Bp > 0`, `tp > 0`, `e_p ≥ d_b`, `w > 0`, `Fexx > 0`, `Fyp > 0`, `Fup > 0`, `Lw > 0` when `flare`.
- Warning when `flare` and `2·Lw > Lp` ("flare weld length exceeds the plate").
- Warning (not error) when custom `coverIn > t/2 − d_b/2` ("cover exceeds the centered value for this wall").

### 4.4 Results object
`{ok, errors, warnings, checks, vals:{t, db, As, fy, Fs, gamma, cover, clear, nineDb, K, Kgov:'cover'|'clear'|'9db', ld_eq, ld, epoxyApplied, minGoverns, Tcap, ep, Tbar, TbarCap, Lwt, te, noteA, Awe, Rnw, Rcap_w, RnBMy, RnBMr, Rcap_bm, bmGov, wmin, wminApplies, weldDevelops}, maxDC, governing, governingId, banner}` — same shape as `DWHSS.compute`.

## 5. Fixtures (`MDEP.FIXTURES`, each with `src`)

| id | Case | Expect |
|---|---|---|
| `rek09-asd` | defaults | `Tcap = 12800`, `K = 2.5` (`Kgov = 'clear'`), `cover = 3.5625`, `nineDb = 4.5`, `ld ≈ 18.646` (±0.01), `dev` D/C ≈ 0.777, banner PASS |
| `rek09-sd` | `code: 'sd', T: 9115` | `Tcap = 21600`, `ld ≈ 18.646`, PASS |
| `rek10-single` | `n: 1` | `K = 3.5625` (`Kgov = 'cover'`), `ld ≈ 13.08`, `minGoverns = false` |
| `min12` | `bar: 3, n: 1, fm: 2000, T: 0` | `K = 3.375` (`Kgov = '9db'`), `ld_eq ≈ 7.27 < 12`, `ld = 12`, `minGoverns = true` |
| `epoxy` | defaults + `epoxy: true` | `ld ≈ 27.97`, `dev` FAIL, banner FAIL |
| `gamma13` | `bar: 6, n: 1, Le: 60` | `gamma = 1.3`, `K = 3.4375` (cover), `ld ≈ 39.66` |
| `gamma15` | `bar: 8, n: 1, cmu: 12, Le: 90` | `gamma = 1.5`, `K = 5.3125` (cover), `ld ≈ 52.65` |
| `gr40` | `grade: 40` | `Tcap = 8000` (ASD), `ld ≈ 12.43` |
| `short-embed` | `Le: 16` | `dev` D/C ≈ 1.165, banner FAIL, governing `dev` |
| `nofit` | `Lp: 3` | `ok = false`, error names the plate |
| `mdg-ex9.2-1` | `bar: 5, n: 1, fm: 2000, cmu: 8, Le: 24` | `ld ≈ 19.47` (MDG Ex 9.2-1 publishes 19.5; already the benchmark in `tools/masonry-audit/build-fixtures.mjs:35`) |
| `weld-fillet-asd` | defaults (`fillet`, w 0.25, SMAW, F_EXX 70000, F_up 58000, t_p 0.5) | `Lwt ≈ 1.5708`, `te = 0.17675`, `Awe ≈ 0.2776`, `Rnw ≈ 11661`, `Rcap_w ≈ 5830`, `wmet` D/C ≈ 0.447, `RnBMy ≈ 16965`, `RnBMr ≈ 27332`, `Rcap_bm ≈ 11310` (`bmGov = 'yield'`), `wbm` D/C ≈ 0.231, `wmin = 0.1875` (PASS), `wdev` ratio `Rcap_w/TbarCap ≈ 0.911` → "NO" |
| `weld-fillet-sd` | `code: 'sd', T: 9115` | `Rcap_w ≈ 8746`, `wmet` D/C ≈ 0.521, `Rcap_bm ≈ 16965` (yield, φ = 1.00), `wbm` D/C ≈ 0.269, `wdev` ratio ≈ 0.810 |
| `weld-flare-noteA` | `weldCfg: 'flare', proc: 'smaw', Lw: 4` (#4 → R = 0.25 < 0.375) | `noteA = true`, `te = 0.17675` (fillet w), `Lwt = 8`, `Awe = 1.414`, `Rnw = 59388`, `Rcap_w = 29694`, `wmin` row INFO with `wminApplies = false` |
| `weld-flare-gmaw` | `weldCfg: 'flare', proc: 'gmaw', bar: 6, n: 1, Le: 60, Lw: 4` | `noteA = false`, `te = 0.234375`, `Awe = 1.875`, `Rnw = 78750`, `Rcap_w = 39375`, `wmet` D/C ≈ 0.132, `wmin` row INFO (no fillet) |
| `weld-flare-smaw6` | as above with `proc: 'smaw'` | `te = 0.1171875`, `Rnw = 39375`, `Rcap_w = 19687.5` |
| `weld-thin-plate` | `tp: 0.1875, w: 0.125` | `wmin = 0.125` (PASS at D/C 1.000), `Rcap_w ≈ 2915`, `wmet` D/C ≈ 0.895 |
| `weld-undersize` | `tp: 0.5, w: 0.125` | `wmin = 0.1875`, `wmin` D/C = 1.5 → FAIL, banner FAIL, governing `wmin` |

Hand values to record: √1750 = 41.833; 0.13·0.25·60000 = 1950; 1950/(2.5·41.833) = 18.646; 1950/(3.5625·41.833) = 13.084; π·0.5 = 1.5708; 0.707·0.25 = 0.17675; 0.60·70000·0.17675·1.5708 = 11,661. The implementer computes every other expected value by hand in the hand-check doc before coding it; a fixture must never be tuned to the engine.

## 6. UI

- Header "Dowelled Embed Plate — Tension Dowels in Grouted CMU"; ref tags `TMS 402-22 §6.1.6.3.1`, `§8.3.3.1`, `§9.1.4`, `§6.1.7.3.1`, `AISC 360-22 §J2.4`, `MDG 2022 REK-09`.
- Blocks: 0 Code basis · 1 Demand · 2 Wall & masonry · 3 Dowels · 4 Plate · 5 Bar-to-plate weld (weldCfg, w, Lw, proc, Fexx, weldable). `coverIn` hidden unless `barPos = custom`; `s` disabled when `n = 1`; `Lw` and `proc` shown only for `flare`. A one-line hint under `weldCfg` for `flare` with #3–#5: "Table J2.2 note [a]: R < 3/8 in, only the reinforcing fillet is credited."
- Run button, `#errOut`, `#results` with summary banner (`AREv2.getMarkHTML()` prefix), demand cards (T, T_cap, l_d, L_e, K with governing term, weld capacity per bar), sectioned check table with `▶ Calc` detail panels, notes list (MDG vertical-tie advice, A706 / AWS D1.4, weld metal governs over A706 bar metal, kds taken as 1.0, no bearing/shear/plate-flexure checks here, no excess-reinforcement reduction, epoxy rule).
- Live re-run on input change once results are shown (250 ms debounce), `window.runCalcs`, `?selftest=1` sets `document.title = 'SELFTEST PASS n/n'`.
- `AREv2.publish` the dowel `ld` and `T`; no new `TARGETS` entry.

## 7. Drawing (`#schemSvg`, `AREDraw` primitives as in the lap calc lines 565–890)

Two views side by side:
- **Wall section** (across t): unit outline with face shells, grouted core, plate on top (`Bp × tp`), one dowel centered (or at custom cover), dims `t`, `cover`, `L_e`, and `l_d` as a bracket from the plate underside; Mark via `AREv2.getMark()` in the view title.
- **Elevation along the plate** (`Lp`): plate, `n` dowels at `s`, dims `e_p`, `s`, `clear`, `L_e`; tension arrow T upward at the plate centroid. Weld symbol at the plate: fillet all-around at each dowel for `fillet`; for `flare` the dowels are drawn lying along the plate face with the weld length `L_w` dimensioned.
Redraw on every input change and after restore.

## 8. Out of scope (stated in the notes list)

- Beam bearing on the plate, masonry bearing, anchor shear — `embed-plate-beam-bearing` / `masonry-bearing-uplift`.
- Plate flexure. Weld procedure and qualification per AWS D1.4/D1.4M are the fabricator's; the calc sizes the weld by AISC 360-22 §J2 strength only, with `kds = 1.0`.
- Dowel-to-vertical-bar lap: `masonry-lap-length`.
- Headed studs or anchor bolts (§6.3 / §8.1.4 / §9.1.4.1): `masonry-anchor-bolt`.

## 9. Reference verification (to be recorded in the hand-check doc)

| Item | Source | Value |
|---|---|---|
| Eq. 6-2, K definition, γ tiers, 12 in floor, epoxy ×1.5 | TMS 402-22 §6.1.6.3.1, PDF p. 96 | as §4.1 |
| No 72·d_b cap in 402-22 | full-text search | confirmed absent |
| F_s = 32,000 (Gr 60), 20,000 (Gr 40/50) | §8.3.3.1, PDF p. 148 | |
| φ = 0.90 tension-controlled | Table 9.1.4, PDF p. 157; MDG REK-09 SD uses 0.9·A_s·f_y | |
| A706 / CE submittal / AWS D1.4 | §6.1.7.3.1, PDF p. 101; TMS 602 Art. 3.4 B.7 | |
| Bar table | Table CC-6.1.3, PDF p. 89 | |
| REK-09 ASD | MDG PDF p. 745 | T_all 12,800; K 2.5; l_d 18.6 |
| REK-09 SD | MDG PDF p. 814 | T_u 9,115; φT_n 21,600 |
| REK-10 | MDG PDF p. 746 | K 3.57; l_d 13.1 |
| Fillet weld Eq. J2-4, `F_nw = 0.60·F_EXX`, φ = 0.75, Ω = 2.00 | AISC 360-22 §J2.4 Eq. J2-4 printed 16.1-130; Table J2.5 printed 16.1-131 to 132 (`Steel/Reference/AISC 2022/…a360-22w.pdf`) | |
| Flare-bevel-groove effective throat 5/8 R (GMAW, FCAW-G), 5/16 R (SMAW, FCAW-S, SAW); note [a] R < 3/8 in → reinforcing fillet only | AISC 360-22 Table J2.2, printed 16.1-126 | |
| Fillet effective throat = shortest distance root to face (0.707·w for equal legs) | AISC 360-22 §J2.2a | |
| Minimum fillet size by thinner part | AISC 360-22 Table J2.4, printed 16.1-128 | 1/8, 3/16, 1/4, 5/16 |
| Base metal shear yielding `0.60·F_y·A_gv` (φ 1.00, Ω 1.50) and shear rupture `0.60·F_u·A_nv` (φ 0.75, Ω 2.00) | AISC 360-22 §J4.2 Eq. J4-3 (foot of printed 16.1-145), Eq. J4-4 (16.1-146) | |
| Table J2.4 minimums do not apply to fillet reinforcement of groove welds | AISC 360-22 §J2.2b(a) | |
