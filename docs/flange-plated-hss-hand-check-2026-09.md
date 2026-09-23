# Hand check — Flange-Plated Moment Connection to HSS Column

_2026-09-22 · `public/Calcs/flange_plated_HSS_column_moment_connection_calculator.html`_

Basis: AISC 360-22; AISC Companion v15.1 Design Example II.B-2 pp. IIB-20 to IIB-26 (welded flange-plated FR moment connection, W18×50 to W14×99); AISC Design Guide 24 Table 7-2 / 7-2A pp. 80–82 and Example 4.3 pp. 46–48 (W16×57 flange on HSS10×10×½). Fixture definitions are in `docs/superpowers/specs/2026-09-22-flange-plated-hss-moment-connection-design.md` §6; they run in-page (`?selftest=1`) and in `tools/test-flange-plated-hss.mjs`.

## 1. Fixture results (engine fixtures 50/50, UI wiring 19/19 on 2026-09-22)

| Fixture | Source · page | Quantity | Published value | Calculator value | Tolerance | Result |
|---|---|---|---|---|---|---|
| F1 | II.B-2 p. IIB-22 | `dm` plate centerlines | 18.9 | 18.875 | rounding | PASS |
| F1 | II.B-2 p. IIB-22 | `Puf` plates | 160 | 160.0 | ±0.5 | PASS |
| F1 | II.B-2 p. IIB-22 | `Puf` welds (dm = d) | 168 | 168.0 | ±0.5 | PASS |
| F1 | II.B-2 p. IIB-22 | top plate `φRn` J4-1 | 194 | 194.4 | ±1 | PASS |
| F1 | II.B-2 p. IIB-23 | top weld length `l` | 8.94 | 8.94 | ±0.01 | PASS |
| F1 | II.B-2 p. IIB-23 | `Rnwl`, `Rnwt`, `Rn` (J2-6b) | 166, 55.7, 225 | 165.9, 55.7, 224.6 | ±1 | PASS |
| F1 | II.B-2 p. IIB-23 | top welds `φRn` | 169 | 168.5 | ±1 | PASS |
| F1 | II.B-2 p. IIB-23/24 | `t_min` beam flange, plate (Eq. 9-2) | 0.238, 0.266 | 0.238, 0.266 | ±0.002 | PASS |
| F1 | II.B-2 p. IIB-24 | top plate-to-column `D_min` | 6.39 | 6.39 | ±0.02 | PASS |
| F1 | II.B-2 p. IIB-24 | bottom plate `r`, `Lc/r` | 0.217, 5.24 | 0.217, 5.24 | ±0.001, ±0.02 | PASS |
| F1 | II.B-2 p. IIB-25 | bottom plate `φPn` J4-6 | 212 | 212.6 | ±1 | PASS |
| F1 | II.B-2 p. IIB-25 | bottom weld `l_min` | 12.1 | 12.07 | ±0.05 | PASS |
| F1 | II.B-2 p. IIB-25 | `Anv` at 12½ in welds | 14.3 | 14.25 | rounding | PASS |
| F1 | II.B-2 p. IIB-25 | flange rupture `φRn` J4-4 | 419 | 416.8 | rounding of Anv | PASS |
| F1 | II.B-2 p. IIB-26 | bottom plate-to-column `D_min` | 4.38 | 4.38 | ±0.02 | PASS |
| F2 | DG24 Ex 4.3 p. 47 | `B/t`, `β` | 21.5, 0.712 | 21.5, 0.712 | — | PASS |
| F2 | DG24 Ex 4.3 p. 47 | plate local yielding `Rn`, `φRn` | 70.8, 67.3 | 70.8, 67.3 | ±0.2 | PASS |
| F2 | DG24 Ex 4.3 p. 47 | punching, sidewall | not applicable | N/A rows | — | PASS |
| F3 | hand, Eq. K1-4/K1-6 | `U`, `Qf` (Pu = 700 k, β = 1) | 0.885, 0.946 | 0.885, 0.946 | 1e-6 | PASS |
| F3 | hand, Table 7-2 K1-4 | sidewall yielding `Rn` = 2·46·0.465·(5·0.6975 + 0.75) | 181.3 | 181.3 | 1e-6 | PASS |
| F3 | hand, Table 7-2 K1-5 | sidewall crippling `Rn`, `φRn` | 476.9, 357.7 | 476.9, 357.7 | 1e-6 | PASS |
| F4 | hand, Table 7-2 K1-3 | punching `Bep`, `Rn`, `φRn` (Bp = 9.0) | 4.185, 126.7, 120.3 | same | 1e-6 | PASS |
| F5 | hand, Table 7-2 K1-6 | cross-connection sidewall buckling `Rn`, `φRn` | 612.9, 551.6 | same | 1e-6 | PASS |
| F6 | hand, E3-2 | compression plate with `Lc/r` = 32.6 | `φPn` 122.5 | 122.5 | 1e-6 | PASS |
| F7 | validation | plate wider than column | rejected | error box | — | PASS |

F1 uses a custom column B = H = 10 in, t = 1.0 in, Fy = 50 ksi so that Be = Bp and the plate-to-column welds reproduce the example's W-column numbers. F3–F6 expectations are computed in the test with independent arithmetic, not typed constants.

## 2. Decisions recorded

- **Resistance factors on the column side are DG24's** (0.95 plate local yielding and punching, 1.00 sidewall yielding, 0.75 crippling, 0.90 buckling). AISC 360-22 §K2.3 routes rectangular-HSS concentrated loads to Chapter J, whose φ for the same limit states are 0.90 (J4.1/J4.4) and 1.00 (J4.2). Every row cites both; the page note states the difference.
- **Sidewall rows are applied when β ≥ 0.85**, per 360-22 Commentary K2 ("transferred predominantly to the sidewalls"). DG24 Table 7-2 states them for β = 1.0. Punching still runs whenever Bp ≤ B − 2t, so between 0.85 and B − 2t both the face and the sidewalls are checked.
- **Plate-to-column weld effective length is 2·Be** (Table K5.1, Eq. K5-4), not 2·Bp. The 1.5 directional factor follows Example II.B-2 and is a checkbox; §K5's "no increase" user note concerns welds to the end of an HSS branch, not a plate on a chord face.
- **Flange forces**: dm between plate centerlines for plate and column checks, dm = d for the welds to the beam flange, exactly as II.B-2.
- **Transverse end weld on the beam flange** is offered only when the plate is narrower than the flange (II.B-2 top plate); a plate wider than the flange gets longitudinal welds only (II.B-2 bottom plate). The checkbox disables itself.
- **Not covered**: web shear connection, §K1.4 end-distance reduction, reinforcement, column member checks, ASD.
