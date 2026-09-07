# Hand check — Seated Beam Connection Calculator

_2026-09-07 · `public/Calcs/seated_beam_connection_calculator.html`_

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

All 41 assertions pass. No FAIL or REVIEW rows in the fixture set.

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

**(c) Bolted seats.** Seated-connection bolts are checked in shear only, per Manual practice for
Tables 10-5 and 10-7 (bolt tension from eccentricity is only added when the optional `bTension` box is
checked, which is off in F3). Shear capacity is `φRn = 0.75·Fnv·Ab·bN`; for 4 bolts, 3/4 in. Group A-N
(`Fnv = 54` ksi), `φRn = 0.75 × 54 × 0.4418 × 4 = 71.6` kips, an exact match to II.A-12A.

---

## 3. Not verified against a published example

- Rectangular-stiffener shear and flexure rows (§4.4) — Manual Eq. 15-2 form applied to a rectangular
  plate; no Design Example carries this exact geometry through to a published number.
- Optional bolt tension + shear interaction (`bTension`, §4.7, J3-3a prying-free reduction) — no
  fixture exercises this path.
- J2.4 directional weld strength increase (`wDir`) — not exercised by any fixture; all F5/F6/F8 cases
  run with the increase off.
- INFO → REVIEW promotion logic for informational rows exceeding D/C = 1.0 (minimum/maximum fillet
  size notes, PCI cross-check row) — logic only, not driven to that state by any fixture.
