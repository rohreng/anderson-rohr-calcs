# Flange-Plated Moment Connection to HSS Column — Design Spec

*Anderson Rohr Engineering · 2026-09-22 · AISC 360-22 LRFD · Design Example II.B-2 (beam side) · DG24 Table 7-2 (column side)*

## 1. Purpose

One ARE web calculator for a welded flange-plated FR moment connection between a W-shape beam and a rectangular HSS column. The top and bottom flange plates are transverse plates on the column face (plate end butts the face, fillet welds across the face on both sides of the plate). Configuration confirmed by Nick 2026-09-22; the notched-plate-on-sidewalls variant is out of scope.

Basis documents on this machine:

| Item | Path |
|---|---|
| Beam, plate and weld checks | `Technical Resources/Steel/Reference/AISC 15th Edition (current)/AISC Companion Examples 15.1.pdf`, Example II.B-2 pp. IIB-20 to IIB-26 |
| Column checks | `Technical Resources/Steel/Reference/AISC DESIGN GUIDE (DSG)/DG24-Hollow Structural Section Connections.pdf`, Table 7-2 / 7-2A pp. 80–82, Example 4.3 pp. 46–48 |
| Spec sections | `Technical Resources/Steel/Reference/AISC 2022/…a360-22w.pdf`: §K1.2a (Eq. K1-1, K1-2), §K1.3 (Eq. K1-4, K1-6), §K2.3, §K5 Table K5.1 (Eq. K5-4), §J2, §J4, §J10 |

AISC 360-22 §K2.3 routes rectangular-HSS concentrated loads to Chapter J through the §K1.2a effective widths; Commentary K2 states that a plate wider than 0.85B delivers its force to the sidewalls. DG24 Table 7-2 is kept as the procedure (its equation numbers are 360-10/16), the resistance factors are DG24's, and each row cites the 360-22 section alongside.

## 2. Files and registration

| Item | Value |
|---|---|
| Calc file | `public/Calcs/flange_plated_HSS_column_moment_connection_calculator.html` |
| Copy for Nick's working folder | `OneDrive - Rohr Engineering/RE CODING/Steel/flange_plated_HSS_column_moment_connection_calculator.html` |
| `app/lib/calcs.ts` entry | slug `flange-plated-hss-moment`, label "Flange-Plated Moment Connection to HSS Column", group `HSS Connections`, category `Connections`, material `Steel`, calcType `Connections`, spec `AISC 360-22 / DG24`, status `ready`, icon `hss-joint` |
| `public/are-utils-v2.js` | file added to `HSS_FAMILY` and `CALC_SLUG_MAP` so the HSS chooser banner lists it |
| Node test | `tools/test-flange-plated-hss.mjs`, wired as `npm run test:fphss` and appended to `npm run qa` |
| Hand-check note | `docs/flange-plated-hss-hand-check-2026-09.md` |
| Coverage manifest | `node tools/derive-coverage.mjs --write` |

Template: the seated beam calc — same `<style>` block, `.blk` input blocks, check table with `▶ Calc` panels, `fr()/ov()/f1..f4` helpers, `?selftest=1` runner, `<script src="/are-utils-v2.js" data-no-theme>` last. Every input is a static element with an id, so are-utils captures state by id. No dynamic rows.

Engine: DOM-free `window.FPHSS.compute(inputs) → results` in its own `<script>` block ahead of the UI script, with `runFixtures()`.

## 3. Inputs

Lengths inches, forces kips, stresses ksi, moments kip-ft. Defaults reproduce Example II.B-2 on the beam side; the column defaults to HSS10x10x1/2 (DG24 Example 4.3).

### 3.1 Beam
- `wsec` W-shape select from the embedded `W_DB` (AISC v16.0, W8–W36, `[A, d, bf, tf, tw, kdes, Zx, Sx]`) plus `custom`. `bd`, `bbf`, `btf`, `btw` auto-filled, editable when custom [W18X50: 18.0, 7.50, 0.570, 0.355].
- `FyBeam` [50], `FuBeam` [65].
- `Mu` factored beam end moment [252], `Vu` factored end shear [42.0] — shear is reported only; the web connection is a separate calc (II.B-1 / through-plate / seated).

### 3.2 HSS column
- `hsec` rectangular HSS select from the embedded `HSS_DB` (AISC v16.0, B and H from 4 to 20 in, `[A, H, B, t_des, t_nom, b/t, h/t, Sx, Ix]`) plus `custom`. `cH`, `cB`, `ct`, `cA`, `cS` auto-filled, editable when custom [HSS10X10X1/2: 10, 10, 0.465, 17.2, 32.1].
- `FyCol` [46], `FuCol` [58].
- `colPu`, `colMu` required axial force and strong-axis moment in the column at the connection, on the side of the joint with the higher compression stress (Eq. K1-6) [0, 0].
- `connType`: `T` beam one side [default] | `X` beams both sides, balanced (cross-connection).

### 3.3 Flange plates
- `FyPl` [36], `FuPl` [58].
- Top: `tpT` [1.0], `BpT` [6.0], `LpT` [10.5]. Bottom: `tpB` [0.75], `BpB` [8.75], `LpB` [14.5].
- `setback` beam end to column face [1.0], `underrun` [0.25], `weldGap` distance from the beam end to the start of the plate-to-beam weld on the bottom plate [0.5] (II.B-2 "additional ½ in. to the start of the weld").

### 3.4 Welds
- `Fexx` [70].
- Plate-to-beam-flange fillet legs `wBeamT` [0.3125], `wBeamB` [0.3125]. Weld length per side, blank = auto: `lwT`, `lwB`. Auto top: `LpT − setback − underrun − wBeamT` (II.B-2 termination = weld size). Auto bottom: `LpB − setback − underrun − weldGap − wBeamB`.
- `endWeldT` [on], `endWeldB` [off]: transverse weld across the plate end on the beam flange. Only possible when the plate is narrower than the flange (`Bp ≤ bf`); the checkbox is disabled otherwise and the engine ignores it.
- Plate-to-column fillet legs `wColT` [0.375], `wColB` [0.3125], each side of the plate.
- `dirCol` [on]: apply the J2-5 directional factor 1.5 to the transverse plate-to-column welds (II.B-2 does; §K5 restricts it only for welds to the *end* of a rectangular HSS branch).

## 4. Engine

Row shape: `{section, id, name, ref, demand, capacity, dc, status, note, det, informational}`, `status ∈ PASS | FAIL | REVIEW | N/A | INFO`, same promotion rules as the seated calc. `E = 29000`.

### 4.1 Flange forces
- `dm_pl = d + tpT/2 + tpB/2` (plate and column checks), `dm_w = d` (welds to the beam flange, faying surface) — Manual Eq. 12-1a as applied in II.B-2.
- `Puf_pl = 12·Mu/dm_pl`, `Puf_w = 12·Mu/dm_w`. Both INFO rows.

### 4.2 Tension (top) plate — II.B-2
- **Tensile yielding** J4-1: `φRn = 0.90·Fyp·Bp·tp` vs `Puf_pl`.
- **Plate-to-beam welds** J2.4: `Rnwl = 2·0.6·Fexx·0.707·w·l`, `Rnwt = 0.6·Fexx·0.707·w·Bp` if the end weld is on; `Rn = max(Rnwl + Rnwt, 0.85·Rnwl + 1.5·Rnwt)` (J2-6a/b), `φ = 0.75`, vs `Puf_w`. Without the end weld `Rn = Rnwl`. Detail also reports the required length `l_min = Puf_w/(2·1.392·D)` for a longitudinal-only weld.
- **Base metal at welds** Manual Eq. 9-2: `t_min = 3.09·D/Fu` for the beam flange and for the plate, `dc = t_min/t`.
- **Beam flange shear rupture at welds** J4-4: `Anv = 2·tf·l`, `φRn = 0.75·0.6·Fu·Anv` vs `Puf_w` (II.B-2 does this on the bottom flange; applied to both for symmetry).
- **Plate-to-column welds** §K5 Table K5.1 Eq. K5-4: `le = 2·Be`, `Be = (10/(B/t))·(Fy·t/(Fyp·tp))·Bp ≤ Bp` (K1-1); `φrn = 0.75·0.6·Fexx·0.707·w·kt = 1.392·D·kt` kip/in, `kt = 1.5` when `dirCol`; `φRn = φrn·le` vs `Puf_pl`. Detail reports `D_req = Puf_pl/(1.392·kt·le)` in sixteenths.
- **Fillet size limits**: Table J2.4 minimum against the thinner part, J2.2b(b) maximum along the plate edge — REVIEW rows for the beam-side and column-side welds.

### 4.3 Compression (bottom) plate — II.B-2
- **Compressive strength** J4.4: `r = tp/√12`, `K = 0.65`, `L = setback + underrun + weldGap`; if `Lc/r ≤ 25`, `φPn = 0.90·Fyp·Bp·tp` (J4-6); otherwise Chapter E `Fcr` with `φ = 0.90` (E3-2/E3-3). vs `Puf_pl`.
- Plate-to-beam welds, base metal, beam flange shear rupture, plate-to-column welds, fillet limits — as §4.2 with the bottom-plate inputs.

### 4.4 HSS column — DG24 Table 7-2, per plate
`β = Bp/B`, `B/t`, `k = 1.5t`, `N = tp` (bearing length along the column axis).
- **Limits of applicability** Table 7-2A / §K1.3: `B/t ≤ 35`, `H/t ≤ 35`, `0.25 ≤ β ≤ 1.0`, `Fy ≤ 52`, `Fy/Fu ≤ 0.8`, `Fyp ≤ 52`, `Fyp/Fup ≤ 0.8`. One row per plate; REVIEW when any limit is outside, listing which.
- **Fit on the flat** DG24 Ex 4.3: `Bp ≤ B − 3t` → INFO; otherwise REVIEW "plate reaches the corner radius; welds at the corners are flare-bevel groove welds, not fillets".
- **Local yielding of plate, uneven load distribution** (Table 7-2 Eq. K1-2 → 360-22 Eq. K1-1 with J4): `Rn = Fyp·tp·Be`, `φ = 0.95`, vs `Puf_pl`.
- **HSS shear yielding (punching)** (Table 7-2 Eq. K1-3 → 360-22 Eq. K1-2 with J4.2): applicable when `0.85B ≤ Bp ≤ B − 2t`; `Bep = (10/(B/t))·Bp ≤ Bp`, `Rn = 0.6·Fy·t·(2tp + 2Bep)`, `φ = 0.95`. N/A otherwise with the reason (below 0.85B the face flexes and the plate check governs; above B − 2t the load goes to the sidewalls).
- **Sidewall local yielding** (Table 7-2 Eq. K1-4 → 360-22 §J10.2, two walls, `k = 1.5t`): applies when `β ≥ 0.85` (Comm. K2; Table 7-2 states β = 1.0); `Rn = 2·Fy·t·(5k + N)`, `φ = 1.00`. N/A otherwise.
- **Sidewall local crippling**, compression plate, T-connection (Table 7-2 Eq. K1-5 → 360-22 §J10.3): when `β ≥ 0.85`; `Rn = 1.6·t²·[1 + 3N/(H − 3t)]·√(E·Fy)·Qf`, `φ = 0.75`.
- **Sidewall local buckling**, compression plate, cross-connection (Table 7-2 Eq. K1-6 → §J10.5): when `β ≥ 0.85` and `connType = X`; `Rn = 48·t³/(H − 3t)·√(E·Fy)·Qf`, `φ = 0.90`. Replaces the crippling row.
- `Qf` (360-22 Eq. K1-4): `Qf = 1.3 − 0.4·U/β`, clamped to `0.4 ≤ Qf ≤ 1.0`; `U = Pu/(Fy·A) + 12·Mu/(Fy·S)` (Eq. K1-6). `Qf = 1` for the tension plate. Reported in a demand card.

### 4.5 Summary
- `maxDC` over non-informational rows; `governing` = row name. Connection flexural strength `φMn = Mu/maxDC` (kip-ft) reported in the banner and a demand card, with the governing row named.
- Banner: FAIL if any FAIL, else REVIEW if any REVIEW, else PASS.

### 4.6 Validation
Positive numbers for every dimension, strength and weld size; `Mu > 0`; `Bp ≤ B` for each plate ("plate wider than the column: transverse-plate model does not apply"); each plate's auto weld length > 0; weld-length overrides blank or positive; `colPu`, `colMu ≥ 0`.

## 5. UI

Header, ref tags (AISC 360-22, §J2/J4/J10, §K1–K2–K5, DG24 Table 7-2, Design Example II.B-2, DG24 Ex 4.3). Schematic SVG drawn inline (elevation: HSS column, beam with top and bottom plates, welds; plan: column face with the plate width, B and Be marked). Blocks: 1 Beam & demands, 2 HSS column, 3 Flange plates, 4 Welds. Results: summary banner, demand cards (`Puf` plates, `Puf` welds, `dm`, `Be` top/bottom, `β`, `Qf`, `φMn`), properties table, check table grouped by section (Flange forces · Top plate · Bottom plate · HSS column), advisory box, assumptions box, provenance footer. Inputs re-run live after the first run (seated calc pattern). Mark field via `AREv2.getMarkHTML()` in the banner and `getMark()` in the SVG.

## 6. Fixtures (`runFixtures`)

| Id | Source | Setup | Expectations (tolerance) |
|---|---|---|---|
| F1 | II.B-2 pp. IIB-21–26 | W18X50, Mu 252, top PL1×6×10½, bottom PL¾×8¾×1'-2½, setback 1, underrun ¼, gap ½, 5/16 welds to beam, top end weld on, custom column B = H = 10, t = 1.0, Fy 50, Fu 65 (wide and stiff enough that Be = Bp, standing in for the W14×99 column flange of the example), `lwB` override 12.5, `wColT` 6.39/16, `wColB` 4.38/16 | dm 18.875 (the example rounds to 18.9); Puf_pl 160; Puf_w 168 (±0.5); φRn top yield 194 (±1); l top 8.94 (±0.01); Rnwl 166, Rnwt 55.7, Rn 225, φRn 169 (±1); t_min flange 0.238, plate 0.266 (±0.002); D_req top col weld 6.39 (±0.02); r 0.217, Lc/r 5.24 (±0.02); φPn 212 (±1); l_min bottom 12.1 (±0.05); Anv 14.25 and φRn 416.8 (the example rounds Anv to 14.3 and reports 419); D_req bottom col weld 4.38 (±0.02) |
| F2 | DG24 Ex 4.3 pp. 46–48 | W16X57, HSS10X10X1/2, Fy 46/58, plates tp = 0.715, Bp = 7.12, Fyp 50/65 | B/t 21.5; β 0.712; Rn plate local yielding 70.8, φRn 67.3 (±0.2); punching N/A; sidewall rows N/A |
| F3 | hand calc, 360-22 Eq. K1-4/K1-6 and Table 7-2 K1-4/K1-5 | HSS10X10X1/2, Bp = 10 (β = 1), tp = 0.75, Pu 700 | U 0.885, Qf 0.946 (±0.002); sidewall yielding Rn 181.3 (±0.3); crippling Rn 476.8, φRn 357.6 (±0.5) |
| F4 | hand calc, Table 7-2 K1-3 | HSS10X10X1/2, Bp = 9.0, tp = 0.75 | Bep 4.186; Rn 126.7, φRn 120.4 (±0.3) |
| F5 | F3 with `connType = X` | | sidewall buckling Rn = 48·0.465³/(10 − 1.395)·√(29000·46)·0.946 = 613.1 (±0.5), φRn 551.8 |

## 7. Out of scope / notes shown on the page
Web (shear) connection; column stiffening or through-plate reinforcement; the §K1.4 end-distance 50% reduction near an unreinforced column end; column member interaction; seismic (prequalified) connections; ASD.
