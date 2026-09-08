# Hand check — Seated Beam Connection Calculator

_2026-09-07, revised 2026-09-08 (F15 bolted stiffened seat; F16–F18 seat moment couple) · `public/Calcs/seated_beam_connection_calculator.html`_

Basis: AISC 360-22; AISC Companion v15.1 Design Examples II.A-12A pp. IIA-124–127, II.A-13
pp. IIA-134–136, II.A-14 pp. IIA-137–140, II.A-15 pp. IIA-141–144, II.A-16 pp. IIA-145–147,
II.A-22 pp. IIA-217–223, II.A-23 pp. IIA-224–229; PCI Design Handbook 7th Ed. p. 6-44
Ex. 6.6.7.1. Fixture definitions are `docs/superpowers/specs/2026-09-07-seated-beam-connection-design.md`
§9; the weld model reproduced against Tables 10-6/10-8 is §4.6 of the same spec.

---

## 1. Fixture results

| Fixture | Source · page | Quantity | Published value | Calculator value | Tolerance | Result |
|---|---|---|---|---|---|---|
| F1 | II.A-12A p. IIA-124 | `lb,WLY` | 0.311 | 0.3092 | ±0.01 | PASS |
| F1 | II.A-12A p. IIA-124 | `lb,min` | 1.03 | 1.0300 | ±0.01 | PASS |
| F2 | II.A-12A p. IIA-125 | OSL flexure `φMn` | 90.0 | 90.00 | ±0.3 | PASS |
| F3 | II.A-12A p. IIA-126 | bolt shear `φRn` | 71.6 | 71.57 | ±0.5 | PASS |
| F3 | II.A-12A p. IIA-126 | bearing, angle | 196 | 195.8 | ±0.5 | PASS |
| F3 | II.A-12A p. IIA-127 | bearing, support (0.75 × 205.9 = 154.4; example rounds 206 × 0.75) | 155 | 154.4 | ±0.5 | PASS |
| F4 | II.A-13 p. IIA-134 | `lb,min` | 1.12 | 1.1200 | ±0.01 | PASS |
| F4 | II.A-13 p. IIA-135 | OSL flexure `φMn` | 81.0 | 81.00 | ±0.3 | PASS |
| F5 | II.A-13 p. IIA-136 | seat weld `φRn` (Table 10-6: 66.7) | 66.0–67.5 | 66.81 | band | PASS |
| F6 | II.A-16 p. IIA-146 | seat weld `φRn` (Table 10-6: 53.4) | 52.8–54.0 | 53.46 | band | PASS |
| F7 | II.A-14 p. IIA-137 | `W,min` crippling (Eq. J10-5b) | 6.93 | 6.925 | ±0.03 | PASS |
| F7 | II.A-14 p. IIA-137 | `W,min` yielding | 3.59 | 3.589 | ±0.03 | PASS |
| F7 | II.A-14 p. IIA-137 | `lb/d` | 0.296 | 0.2962 | ±0.03 | PASS |
| F8 | II.A-14 p. IIA-139 | stiffener weld `φRn` (Table 10-8: 139) | 130–139 | 130.78 | band | PASS |
| F8 | II.A-14 p. IIA-138 | `t,min`, two-sided weld (2w) | 0.625 | 0.625 | as stated | PASS |
| F8 | II.A-14 p. IIA-138 | `t,min`, vs. web | 0.597 | 0.597 | as stated | PASS |
| F9 | II.A-15 p. IIA-142 | `t,min`, one-sided weld | 0.238 | 0.2377 | ±0.003 | PASS |
| F9b | II.A-15 p. IIA-142 | `t,min`, both sides | 0.476 | 0.4762 | ±0.003 | PASS |
| F10 | II.A-23 p. IIA-225 | `θ` | 32.6° | 32.57° | 1% | PASS |
| F10 | II.A-23 p. IIA-225 | `a'` | 21.4 | 21.36 | 1% | PASS |
| F10 | II.A-23 p. IIA-225 | `b'` | 9.70 | 9.69 | 1% | PASS |
| F10 | II.A-23 p. IIA-226 | Section A-A `φMn` | 1970 | 1968.3 | 1% | PASS |
| F10 | II.A-23 p. IIA-226 | Section A-A `Mu` | 446 | 445.50 | 1% | PASS |
| F10 | II.A-23 p. IIA-226 | Section B-B `Vu` | 29.1 | 29.07 | 1% | PASS |
| F10 | II.A-23 p. IIA-227 | Section B-B `φVn` | 157 | 156.99 | 1% | PASS |
| F10 | II.A-23 p. IIA-228 | `λ` | 1.17 | 1.168 | 1% | PASS |
| F10 | II.A-23 p. IIA-228 | `Q` | 0.771 | 0.773 | 1% | PASS |
| F10 | II.A-23 p. IIA-228 | `Fcr` | 27.8 | 27.81 | 1% | PASS |
| F10 | II.A-23 p. IIA-228 | `Nu` | 45.5 | 45.51 | 1% | PASS |
| F10 | II.A-23 p. IIA-228 | `φNn` | 182 | 181.94 | 1% | PASS |
| F10 | II.A-23 p. IIA-229 | `Mu,BB` | 225 | 225.00 | 1% | PASS |
| F10 | II.A-23 p. IIA-229 | `φMn,BB` | 441 | 440.79 | 1% | PASS |
| F10 | II.A-23 p. IIA-229 | interaction D/C | 0.760 | 0.761 | 1% | PASS |
| F11 | II.A-22 p. IIA-218 | `λ` | 1.43 | 1.431 | 1% | PASS |
| F11 | II.A-22 p. IIA-218 | `Q` | 0.636 | 0.635 | 1% | PASS |
| F11 | II.A-22 p. IIA-218 | `Fcr` | 22.9 | 22.85 | 1% | PASS |
| F12 | PCI DH 7th Ed. p. 6-44, Ex. 6.6.7.1 | `z` | 0.315 | 0.3148 | ±0.002 | PASS |
| F12 | PCI DH 7th Ed. p. 6-44, Ex. 6.6.7.1 | `φVn` | 28.9 | 28.90 | ±0.1 | PASS |
| F13 | baseline (II.A-14 defaults) | defaults compute without error | no error | ok | — | PASS |
| F13 | baseline (II.A-14 defaults) | summary banner | PASS | PASS, maxDC = 1.000 | — | PASS |
| F14 | NaN guard | `Ru = NaN` | blocking error | blocked | — | PASS |
| F15 | hand computed (§1.1) | `T_top` | 8.96 | 8.960 | 1% | PASS |
| F15 | hand computed (§1.1) | `F'nt` | 41.6 | 41.55 | 1% | PASS |
| F15 | hand computed (§1.1) | `φr_nt` | 13.78 | 13.767 | 1% | PASS |
| F15 | hand computed (§1.1) | wrench clearance row status | PASS | PASS | — | PASS |
| F16 | hand computed (§1.2) | couple `T` | 46.67 | 46.667 | 1% | PASS |
| F16 | hand computed (§1.2) | tension-zone length `Lz` | 21.0 | 21.000 | 1% | PASS |
| F16 | hand computed (§1.2) | weld `φRw` | 146.2 | 146.15 | 1% | PASS |
| F16 | hand computed (§1.2) | base metal `φRbm` | 224.8 | 224.77 | 1% | PASS |
| F16 | hand computed (§1.2) | `φRn` (weld governs) | 146.2 | 146.15 | 1% | PASS |
| F16 | hand computed (§1.2) | `coupleT` D/C | 0.319 | 0.319 | 1% | PASS |
| F16 | hand computed (§1.2) | flange Eq. J10-1 `φRn` | 141.8 | 141.78 | 1% | PASS |
| F16 | hand computed (§1.2) | `supCouple` D/C | 0.329 | 0.329 | 1% | PASS |
| F17 | hand computed (§1.3) | web Eq. J10-2 `φRn` | 289.9 | 289.85 | 1% | PASS |
| F17 | hand computed (§1.3) | `supCouple` D/C | 0.161 | 0.161 | 1% | PASS |
| F18 | hand computed (§1.4) | computes without error | no error | ok | — | PASS |
| F18 | hand computed (§1.4) | `M` | 19.2 | 19.200 | 1% | PASS |
| F18 | hand computed (§1.4) | couple `T` | 3.2 | 3.200 | 1% | PASS |
| F18 | hand computed (§1.4) | weld return `h` | 1.2 | 1.200 | 1% | PASS |
| F18 | hand computed (§1.4) | `Lz` | 8.4 | 8.400 | 1% | PASS |
| F18 | hand computed (§1.4) | weld `φRw` | 46.8 | 46.77 | 1% | PASS |
| F18 | hand computed (§1.4) | `coupleT` D/C | 0.068 | 0.068 | 1% | PASS |

All 62 assertions pass. No FAIL rows in the fixture set; F15–F18 raise no REVIEW row either.

### 1.1 F15 — bolted rectangular stiffened seat, hand computation

Added with the 2026-09-08 revision (spec §3.6, §4.7). No Design Example covers a bolted
stiffened seat, so this fixture is hand computed and the arithmetic is written out here.

Inputs: rectangular stiffened seat, bolted to the support. W21X68 beam, `Ru = 60` kips,
`e = 5.6` in (entered, not the 0.8W default). Stiffener `PL 5/8 × 7 × 15`, one plate,
`Fy = 36`, `Fu = 58` ksi. Support `t = 0.710` in, `Fu = 65` ksi. Bolts: four 3/4 in.
Group A, threads included (N), two rows of two straddling the stiffener stem, row spacing
`s = 3` in, gage `g = 5.5` in, top row `le = 3` in below the top of the seat plate.

The seat rotates about the bottom of the vertical plate, `L = 15` in below the top of the
seat plate, so the row heights above that pivot are

- `y_1 = 15 − 3 − 0 = 12.0` in, `y_2 = 15 − 3 − 3 = 9.0` in
- `Σy² = 12.0² + 9.0² = 144 + 81 = 225` in²
- `M = Ru·e = 60 × 5.6 = 336` kip-in
- `T_top = M·y_1/(perRow·Σy²) = 336 × 12/(2 × 225) = 8.96` kips/bolt

Combined tension and shear, AISC 360-22 §J3.8 Eq. J3-3a, with `Ab = π(0.75)²/4 = 0.4418` in²,
`Fnt = 90` ksi, `Fnv = 54` ksi:

- `frv = Ru/(n·Ab) = 60/(4 × 0.4418) = 33.95` ksi
- `F'nt = 1.3 × 90 − 90 × 33.95/(0.75 × 54) = 117 − 75.4 = 41.6` ksi ≤ `Fnt` ✓
- `φr_nt = 0.75 × 41.6 × 0.4418 = 13.78` kips/bolt
- `D/C = 8.96/13.78 = 0.650`

Wrench clearance beside the stem (AISC Manual Table 7-16, C1 for 3/4 in bolts):
`(g − t)/2 = (5.5 − 0.625)/2 = 2.44` in ≥ 1.25 in → PASS.

The calculator returns `T_top = 8.960`, `F'nt = 41.55`, `φr_nt = 13.767`, `D/C = 0.651` and a
PASS on the clearance row — all within 1 %. The 41.55 vs 41.6 difference is rounding of `frv`
in the hand arithmetic only.

### 1.2 F16 — seat moment couple, welded rectangular stiffened seat on a column flange

Added with the 2026-09-08 couple revision (spec §3.1, §4.6). The elastic line-weld row
(`weldMain`) reports a stress, not the force the seat moment delivers to the support, and no
Design Example carries that force through, so these fixtures are hand computed.

Inputs are the calculator defaults, i.e. the II.A-14 case: W21X68, `Ru = 125` kips, rectangular
stiffener `PL 5/8 × 7 × 15`, one plate, seat plate `PL 3/8 × 9`, `Fy = 36`, `Fu = 58` ksi,
5/16 in E70 fillets, `l = L = 15` in and `h = 0.2·l = 3` in (both auto), `e = 0.8·W = 5.6` in
(auto). Support: column flange `t = 0.710` in, `Fy = 50`, `Fu = 65` ksi.

The moment is carried as a couple over the stiffener height — tension at the top of the
stiffener, compression bearing on the support at the bottom:

- `M = Ru·e = 125 × 5.6 = 700` kip-in
- `arm = L = 15` in, `T = M/arm = 700/15 = 46.67` kips

Tension zone of the weld group = the two returns plus the top half of the two vertical welds:

- `Lz = n·(2h + 2·l/2) = 1 × (2 × 3 + 15) = 21.0` in
- unit fillet strength `0.75 × 0.6 × 70 × 0.707 × 0.3125 = 6.960` kip/in
- `φRw = 6.960 × 21.0 = 146.2` kips (`wDir` off, so `kt = 1` on both returns and verticals)

Base metal behind that weld, AISC 360-22 §J4.1, with the returns bearing on the seat plate and
the vertical welds on the stiffener:

- `A = n·(t_sp·2h + t·l/2) = 0.375 × 6 + 0.625 × 7.5 = 2.250 + 4.688 = 6.9375` in²
- yielding `0.90 × 36 × 6.9375 = 224.8` kips; rupture `0.75 × 58 × 6.9375 = 301.8` kips
- `φRbm = 224.8` kips

`φRn = min(146.2, 224.8) = 146.2` kips — the weld governs — and `D/C = 46.67/146.2 = 0.319`.

The same tension pulls on the column flange, AISC 360-22 §J10.1 Eq. J10-1:

- `φRn = 0.90 × 6.25 × Fy,sup · tf² = 0.90 × 6.25 × 50 × 0.710² = 141.8` kips
- `D/C = 46.67/141.8 = 0.329`

The calculator returns `T = 46.667`, `Lz = 21.000`, `φRw = 146.15`, `φRbm = 224.77`,
`φRn = 146.15`, `coupleT` D/C `0.319`, flange `φRn = 141.78` and `supCouple` D/C `0.329` — all
within 1 %. The flange row carries a note that Eq. J10-1 assumes the seat is more than `10·tf`
from the end of the column.

### 1.3 F17 — the same seat on a column web

F16 with the support changed to a column web, `t = 0.440` in, `Fy = 50` ksi, `kdes = 1.31` in.
The couple tension is unchanged at `T = 46.67` kips; only the support limit state changes, to
web local yielding, AISC 360-22 §J10.2 Eq. J10-2. The bearing length delivered to the web is
the two returns plus the stiffener thickness:

- `lb = n·(2h + t) = 2 × 3 + 0.625 = 6.625` in
- `φRn = 1.00 × Fy,sup · tw · (5·kdes + lb) = 50 × 0.440 × (6.55 + 6.625) = 22.0 × 13.175 = 289.9` kips
- `D/C = 46.67/289.9 = 0.161`

The calculator returns `289.85` and `0.161`. The row carries a note that Eq. J10-2 assumes the
seat is more than the member depth from the end of the member; nearer the end the `2.5·kdes`
branch applies instead.

### 1.4 F18 — shallow joist-seat bracket (Nick's case)

A triangular bracket carrying an open-web joist chord rather than a rolled beam: a shallow
chord and a long setback, well outside the geometry any Design Example covers. It exercises the
couple rows at the opposite end of the size range from F16 and confirms the auto `l`/`h`/`e`
defaults hold up when the vertical dimension is smaller than the projection.

Inputs: triangular stiffener, welded, column flange. Custom supported member `d = 2.5`,
`tw = 0.2`, `tf = 0.225`, `kdes = 0.525`, `bf = 4` in, `Fy = 50`, `Fu = 65` ksi. `Ru = 3` kips,
setback 6 in, underrun 0. Stiffener `a = 6`, `b = W = 8`, `t = 7/16` in, one plate; seat plate
`PL 1/2 × 5`; 1/4 in E70 fillet. `e` left blank → `0.8 × 8 = 6.4` in; `l` blank → `a = 6` in;
`h` blank → `0.2 × 6 = 1.2` in.

- `M = Ru·e = 3 × 6.4 = 19.2` kip-in
- `arm = a = 6` in, `T = 19.2/6 = 3.2` kips
- `Lz = 1 × (2 × 1.2 + 6) = 8.4` in
- unit fillet strength `0.75 × 0.6 × 70 × 0.707 × 0.25 = 5.568` kip/in
- `φRw = 5.568 × 8.4 = 46.8` kips
- `A = 0.5 × 2.4 + 0.4375 × 3.0 = 2.5125` in² → yielding `81.4`, rupture `109.3`, `φRbm = 81.4` kips
- `φRn = 46.8` kips (weld governs), `D/C = 3.2/46.8 = 0.068`

The calculator returns `M = 19.200`, `T = 3.200`, `h = 1.200`, `Lz = 8.400`, `φRw = 46.77` and
`coupleT` D/C `0.068`, and `compute` returns `ok = true` — the case is valid input, not an
error. Its overall banner is FAIL, but on an unrelated row: a 1/4 in fillet needs `t ≥ 2w =
0.5` in to develop it and the plate is 7/16 in, so `stTweld` reports D/C 1.14. That is the
correct answer for the geometry as entered; the fixture asserts only the couple quantities and
`ok === true`, not the banner.

---

## 2. How the Manual table strengths were reproduced

**(a) Table 10-5/10-6 seat-angle strength.** The Manual's tabulated OSL flexural strength is not
derived from a stated formula in the examples, only quoted. The calculator reproduces it exactly by
checking flexural yielding at the toe of the fillet, with the eccentricity taken from the bearing
length actually required rather than the leg dimension: `e_f = setback + underrun + lb,req/2 − t −
3/8` (the 3/8 in. is the fillet-toe offset used throughout Part 10). Capacity is the plastic section
modulus of the leg times yield, `φMn = 0.90·Fy·L·t²/4`. With II.A-12A's `lb,req = 1.0625` this gives
`φMn = 90.0` exactly, and with II.A-13's `lb,req = 1.125` it gives `81.0` exactly — both match the
Design Example number to the reported digit, confirming `e_f` and the `t²/4` form are the Manual's
actual basis rather than an approximation.

**(b) Table 10-6 and 10-8 weld strengths.** Both tables list a single allowable weld strength for a
given angle/stiffener size and weld leg, without publishing the underlying section modulus. The
calculator models each weld group as two L-shaped fillet lines — a vertical run of length `l` plus a
top return of length `h = 0.2·l` — treated by elastic line-weld (unit-throat) properties: centroid
`ȳ`, moment of inertia `I`, section modulus `S_top` at the top fiber. The reaction is resolved into a
bending stress `fb = Ru·e/S` and a shear stress `fv = Ru/A_v`, combined as `f_r = √(fb² + fv²)`, and
checked against `φrn = 0.75·0.6·Fexx·0.707·w`. Two modeling choices, both drawn from Blodgett's
*Design of Welded Structures* §5.3 basis as cited in the AISC *Steel Interchange* (April 2022), make
the match work: bending is checked at the **top** fiber, not the bottom, because the seat's
compression side bears directly on the support and only the top of the weld group sees net tension;
and shear is carried by the **vertical legs only** (`A_v = 2·l`), not the full perimeter, since the
returns are a bending-capacity contributor, not a shear path. With these two choices the calculator
returns 66.8 vs. the example's 66.9 (Table 10-6 tabulates 66.7) for II.A-13, and 53.5 vs. 53.5 (Table:
53.4) for II.A-16 — both within a few tenths of a kip. For the stiffened seat (II.A-14, Table 10-8)
the same model gives 130.8 against a tabulated 139, roughly 6% low; the residual gap is consistent
with the return welds also picking up a share of the shear stress in the Manual's derivation, which
the calculator does not credit — it keeps the more conservative vertical-only shear distribution and
reports the wider 130–139 band as an explicit pass range rather than tightening the model to chase
the last few percent. The two ends of that band are the two shear distributions: carrying shear on
the vertical welds alone gives 130.8, and letting the returns carry shear as well reproduces the
tabulated 139.

**(c) Bolted seats.** Seat-**angle** bolts are checked in shear only, per Manual practice for Tables
10-5 and 10-7 (bolt tension from eccentricity is only added when the optional `bTension` box is
checked, which is off in F3). Shear capacity is `φRn = 0.75·Fnv·Ab·bN`; for 4 bolts, 3/4 in. Group A-N
(`Fnv = 54` ksi), `φRn = 0.75 × 54 × 0.4418 × 4 = 71.6` kips, an exact match to II.A-12A.

For a bolted **stiffened** seat (2026-09-08 revision) the bolts are one each side of the stiffener
stem at gage `g`, in one or two rows, so `bN = 2·bRows` is derived rather than entered, and the
tension row is always reported: the vertical plate is a flexural element and the seat moment `Ru·e`
has to go somewhere. The pivot is the bottom of the vertical plate, `L` below the top of the seat
plate, and `le` positions the top row below that same top edge. F15 above is the hand check.

**(d) Seat moment couple (2026-09-08 revision).** Table 10-8 publishes one weld strength per
stiffener size and weld leg, and the elastic line-weld model in (b) reproduces the stress that
sits behind it — but it never reports the force the seat moment actually delivers to the
support, and it does not check the base metal on the tension side of the weld group. The couple
rows do both: `T = Ru·e / (stiffener height at the support)` in tension at the top of the
stiffener against bearing at the bottom, resisted by the two returns plus the top half of the
two vertical welds and by the §J4.1 tension area behind them, then carried into the support by
flange local bending (Eq. J10-1) or web local yielding (Eq. J10-2). The tension zone deliberately
includes the top half of the verticals: the returns alone are 2h ≈ 0.4·l of weld and cannot
develop `T` in the Table 10-8 designs, which would report a false failure on every tabulated
seat. Rows are added for welded stiffened seats only — a seat angle is a flexural element rather
than a couple, and a bolted stiffened seat already carries the moment in its bolt-tension row.
F16–F18 are the hand checks.

---

## 3. Not verified against a published example

- Rectangular-stiffener shear and flexure rows (§4.4) — Manual Eq. 15-2 form applied to a rectangular
  plate; no Design Example carries this exact geometry through to a published number.
- Bolt tension + shear interaction on a **seat angle** (`bTension`, §4.7) — no fixture exercises
  the optional angle path. The stiffened-seat path, where the row is always computed, is covered
  by the hand-computed F15 above but not by any published example.
- Seat moment couple rows (`coupleT`, `supCouple`, §4.6) — hand computed in §1.2–§1.4 above, but the
  couple model itself is an ARE addition beyond the Manual Part 10 table procedure; no Design Example
  reports the couple force or checks the support for it. The split of the tension zone (returns plus
  the top half of the vertical welds) is a modeling choice, calibrated so the Table 10-8 seats do not
  report a false failure — treat a D/C near 1.0 on `coupleT` as a prompt to look at the detail rather
  than a code-published limit.
- J2.4 directional weld strength increase (`wDir`) — not exercised by any fixture; all F5/F6/F8 cases
  run with the increase off, and the `kt = 1.5` transverse factor on the couple returns is likewise
  untested.
- INFO → REVIEW promotion logic for informational rows exceeding D/C = 1.0 (minimum/maximum fillet
  size notes, PCI cross-check row) — logic only, not driven to that state by any fixture.
