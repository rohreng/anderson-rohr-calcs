# Seated Beam Connection Calculator — Design Spec

*Anderson Rohr Engineering · 2026-09-07 · AISC 360-22 LRFD, Manual Part 10 and Part 15 procedures*

## 1. Purpose

One ARE web calculator that designs a beam seat on a steel support (column flange, column web, or girder web) for three seat types and two attachments to the support:

| Seat type | Attachment |
|---|---|
| Unstiffened seat angle (Manual Part 10, Tables 10-5/10-6) | Welded to support |
| Rectangular stiffened seat (Manual Part 10, Tables 10-7/10-8) | Bolted to support |
| Triangular stiffened seat, bracket-plate method (Manual Part 15) | |

Basis documents on this machine: `Technical Resources/Steel/Reference/AISC 2022/…a360-22w.pdf` and `AISC 15th Edition (current)/AISC Companion Examples 15.1.pdf` (Examples II.A-12A, 12B, 13, 14, 15, 16, 22, 23). The Manual itself is not available; every table-derived rule below was reverse-checked against the Design Example numbers and the match is recorded in §9.

PCI Design Handbook 7th Ed. §6.6.6 (Salmon–Johnson z-factor) appears only as an informational cross-check row on the triangular stiffener. Precast-specific statics (concrete inserts, headed studs, compression block) are out of scope.

## 2. Files and registration

| Item | Value |
|---|---|
| Calc file | `public/Calcs/seated_beam_connection_calculator.html` |
| Copy for Nick's working folder | `OneDrive - Rohr Engineering/RE CODING/Steel/seated_beam_connection_calculator.html` |
| `app/lib/calcs.ts` entry | slug `seated-beam-connection`, label "Seated Beam Connection", category `Connections`, material `Steel`, calcType `Connections`, spec `AISC 360-22`, status `ready`, icon `channel-bearing` |
| Node test | `tools/test-seated-connection.mjs`, wired as `npm run test:seat` and appended to `npm run qa` |
| Hand-check note | `docs/seated-connection-hand-check-2026-09.md` (fixture table from §9 with the source page for each number) |
| Coverage manifest | regenerate `tools/calc-coverage.csv` with `node tools/derive-coverage.mjs --write` |

Template: the HSS-column-bearing calc (`hss_column_bearing_on_beam_calculator.html`) — same `<style>` block, `.blk` input blocks, check table with `▶ Calc` detail panels, `fr()/ov()/f1..f4` helpers, `?selftest=1` runner, `<script src="/are-utils-v2.js" data-no-theme>` as the last script. No adapter: every input is a static element with an id, so `are-utils-v2` captures state by id. No dynamic rows.

Engine: a DOM-free object `SEAT.compute(inputs) → results` in its own `<script>` block ahead of the UI script, so the node test can extract and evaluate it the way `tools/test-apa-panel.mjs` does for `APA.compute`.

## 3. Inputs

All lengths inches, forces kips, stresses ksi. Defaults in brackets reproduce Design Example II.A-14 (stiffened, welded, column flange) so the page opens on a verified case.

### 3.1 Mode
- `seatType`: `angle` | `rect` | `tri` [`rect` — the II.A-14 case; a triangular stiffener of that geometry legitimately fails Part 15 and PCI, so it is not a sensible opening state]
- `attach`: `welded` | `bolted` [`welded`]
- `support`: `colFlange` | `colWeb` | `beamWeb` [`colFlange`]
- `bothSides`: checkbox, seats on both sides of a web [off]. Enabled only for `colWeb`/`beamWeb`.

### 3.2 Supported beam
- `wsec`: W-shape select from the embedded `W_DB` (108 shapes W8–W36, copied verbatim from the HSS-column-bearing calc: `[A, d, bf, tf, tw, kdes, Zx, h, Sx]`), plus option `custom`.
- `bd`, `btw`, `btf`, `bkdes`, `bbf`: auto-filled from the select, editable when `custom` [W21X68: 21.1, 0.430, 0.685, 1.19, 8.27]
- `FyBeam` [50], `FuBeam` [65]
- `Ru` factored end reaction [125]
- `setback` [0.5], `underrun` [0.25] — the Manual's 1/2 in. setback plus 1/4 in. possible underrun

### 3.3 Seat geometry (block shown per `seatType`)
Angle:
- `angLeg` vertical leg [8], `angOSL` outstanding leg [4], `angT` thickness [0.625], `angL` angle length [8], `FySeat` [36], `FuSeat` [58]
- `lbReq` required bearing length used for the OSL flexure arm, blank = computed `lb,min` [blank]

Rectangular stiffener:
- `stW` width W (projection from support face) [7], `stL` length (vertical) [15], `stT` thickness [0.625], `stN` number of stiffener plates [1], `FySeat`, `FuSeat`
- `spT` seat plate thickness [0.375], `spB` seat plate width [9] (informational, drives min return length note)

Triangular stiffener:
- `stA` height a at the support face [15], `stW` projection b = W [7], `stT` [0.625], `stN` [1], `FySeat`, `FuSeat`
- `spT`, `spB` as above

### 3.4 Load position
- `eSeat`: reaction eccentricity from the support face used for the seat welds/bolts and stiffener bending. Auto = `0.8·OSL` (angle) or `0.8·W` (stiffened), shown as a placeholder, overridable [auto].

### 3.5 Welded attachment (shown when `attach = welded`)
- `wSize` fillet leg [0.3125], `Fexx` [70]
- `wLen` vertical weld length per line: auto = `angLeg` or `stL`/`stA`, overridable [auto]
- `wRet` top return length per line: auto = `0.2·wLen`, overridable, 0 allowed [auto]
- `wDir` checkbox "apply J2.4 directional strength increase to the resultant" [off]
- `supT` support thickness at the weld (column flange `tf`, or web `tw`) [0.710], `FuSup` [65]

### 3.6 Bolted attachment (shown when `attach = bolted`)
- `bGrade`: `A307` | `A-N` | `A-X` | `B-N` | `B-X` [`A-N`]; `bDia` [0.75]; `bN` bolts [4]; `bRows` rows [2]; `bPitch` vertical pitch [3]; `bGage` [5.5]
- `bLe` top bolt row below the top of the seat element (top of seat plate for stiffened seats, top of the vertical leg for angles); also the loaded-edge distance for tearout [1.25 angle; 3.0 stiffened]
- Stiffened seats (2026-09-08 revision): bolts are placed one each side of the stiffener at gage `g`, so bolts per row is fixed at 2 and `bN = 2·bRows` (`bRows` 1 or 2, `bN` auto-filled and read-only). `bPitch` is the row spacing. Bolt tension from `Ru·e` is always computed for stiffened seats (see §4.7); the `bTension` checkbox applies to seat angles only. Wrench clearance: `(g − t)/2 ≥ 1.25 in` else REVIEW (Manual Table 7-16 entering/tightening clearance for 3/4 in bolts).
- `bLeSup` vertical edge distance on the support, blank = not an edge [blank]
- `supT`, `FuSup`: the same single pair of fields as §3.5 (one support, one thickness; the II.A-14 default 0.710 applies to both modes)
- `bTension` checkbox "add bolt tension from R·e (elastic, neutral axis at bottom edge, J3.7)" [off]

## 4. Engine — checks by mode

Every check row: `{section, id, name, ref, demand, capacity, dc, status, note, det, informational}`; `status ∈ PASS | FAIL | REVIEW | N/A | INFO`. `INFO` marks informational rows (detailing notes, the Part 15 `Fcr` row, the PCI reference row); an informational row whose `dc` exceeds 1.0 is promoted to `REVIEW` so the banner flags it, but informational rows never count toward `maxDC` or `FAIL`. For stiffened seats with `n` plates, demands are reported as the total `Ru` and capacities are multiplied by `n` (identical D/C to the per-plate form). `φ` factors per 360-22. `E = 29000`.

### 4.1 Beam bearing length (all modes)
Reaction is at the beam end (`≤ d` from the end), so the end-branch equations govern.

- Web local yielding, Eq. J10-3, φ = 1.00: `lb,WLY = Ru/(Fyw·tw) − 2.5·kdes` (≥ 0).
- Web local crippling, φ = 0.75, `K = √(E·Fyw·tf/tw)`, `ρ = (tw/tf)^1.5`:
  - Eq. J10-5a (assume `lb/d ≤ 0.2`): `lb = [Ru/(φ·0.40·tw²·K) − 1]·d/(3ρ)`
  - Eq. J10-5b (assume `lb/d > 0.2`): `lb = {[Ru/(φ·0.40·tw²·K) − 1]/ρ + 0.2}·d/4`
  - Use the branch consistent with its own assumption; if neither is consistent, take the larger.
- `lb,min = max(lb,WLY, lb,WLC, kdes)`.
- Bearing length provided: angle `lb,prov = OSL − setback − underrun`; stiffened `lb,prov = W − setback − underrun`.
- Row **Bearing length**: `dc = lb,min / lb,prov`. Detail shows both J10 branches, R1/R2/R3–R6 style intermediate values, and `lb/d`.
- Row **Web local yielding** and **Web local crippling** at `lb,prov`: `dc = Ru/φRn` (redundant with the above but readers expect them).

### 4.2 Unstiffened seat angle (Manual Part 10, Tables 10-5/10-6)
- `lb,req = lbReq || lb,min`. Critical section at the toe of the fillet, `e_f = setback + underrun + lb,req/2 − t − 3/8`.
- **OSL flexural yielding**: `Mu = Ru·e_f`, `φMn = 0.90·Fy·L·t²/4`. If `e_f ≤ 0` the row is N/A with a note.
- **OSL shear yielding** (J4-3): `φVn = 1.00·0.6·Fy·L·t`.
- **OSL length**: `dc = (lb,req + setback + underrun)/OSL`.
- Note rows: angle length vs beam flange width; top angle L4×4×1/4 with two bolts or 3/16 fillet is detailing only (Manual Part 10).

### 4.3 Stiffened seats — common Part 10 rules
- **Stiffener width**: `dc = (lb,min + setback + underrun)/W`.
- **Stiffener thickness vs beam web**: `t,min = tw·FyBeam/FySeat`, `dc = t,min/t`.
- **Stiffener thickness to develop two-sided welds** (welded only): the Manual's stated rule, `t,min = 2w` for `FySeat ≤ 36` and `t,min = 1.5w` for `36 < FySeat ≤ 50`; for other grades or `Fexx ≠ 70` the derivation `t,min = 2·(0.75·0.6·Fexx·0.707·w)/(1.0·0.6·FySeat) = 1.0605·Fexx·w/FySeat` (which the Manual rounds to 2w and 1.5w). `dc = t,min/t`. The detail panel shows the derivation either way.
- **Seat plate return**: informational: seat-plate-to-support weld each side of the stiffener `≥ 0.2·L`, stiffener-to-seat-plate weld `≥` the seat-to-support weld (Manual Part 10, Fig. 10-10).
- Load per plate `P = Ru/stN`.

### 4.4 Rectangular stiffener (`rect`)
- **Shear yielding** (J4-3): `φVn = 1.00·0.6·Fy·t·L` vs `P`.
- **Flexural yielding at support face**: `Mu = P·e`, `φMn = 0.90·Fy·t·L²/4` (Manual Eq. 15-2 form). Row note states this is a conservative addition beyond the Manual Part 10 procedure, which sizes the rectangular stiffener by the thickness rules and the welds.
- No local-buckling check: the Manual's tabulated stiffened seats rely on the thickness rules in §4.3. Stated in the notes.

### 4.5 Triangular stiffener (`tri`, Manual Part 15 bracket plate, Ex. II.A-23)
Geometry: `a = stA`, `b = stW`, `θ = atan(b/a)`, `a' = a/cosθ`, `b' = a·sinθ`, `e = eSeat`.
- **Section A-A shear yielding**: `φVn = 1.00·0.6·Fy·t·a` vs `P`.
- **Section A-A flexural yielding** (Eq. 15-1, 15-2): `Mu = P·e`, `φMn = 0.90·Fy·t·a²/4`.
- **Section B-B shear yielding** (Eq. 15-6, 15-7): `Vu = P·sinθ`, `φVn = 1.00·0.6·Fy·t·b'`.
- **Local yielding / buckling** (Eq. 15-13 to 15-18):
  `λ = (b'/t)·√Fy / (5·√(475 + 1120·(b'/a')²))`;
  `Q = 1.0` for `λ ≤ 0.70`; `Q = 1.34 − 0.486λ` for `0.70 < λ ≤ 1.41`; `Q = 1.30/λ²` for `λ > 1.41`;
  `Fcr = Q·Fy`. Row reports `λ`, `Q`, `Fcr` (informational, feeds the next two).
- **Section B-B normal + flexure interaction** (Eq. 15-8 to 15-12): `Nu = P·cosθ`, `φNn = 0.90·Fcr·t·b'`; `Mu = P·e − Nu·b'/2`, `φMn = 0.90·Fcr·t·b'²/4`; `dc = Nu/φNn + |Mu|/φMn` (Eq. 15-10). The absolute value is a conservative reading: when `e < b'·cosθ/2` the moment reverses sign and must not be credited against the axial term.
- **PCI §6.6.6 cross-check** (informational, `INFO`, promoted to `REVIEW` if its D/C exceeds 1.0, never FAIL): `z = 1.39 − 2.2(b/a) + 1.27(b/a)² − 0.25(b/a)³`, `φVn = 0.85·Fy·z·b·t`, limits Eq. 6-49/6-50 on `b/t`. When `b/a` lies outside 0.75–2.0 the method is not applicable: `dc = null`, status `N/A`, detail says so. Labelled "Salmon–Johnson free-edge yield, PCI DH 7th Ed. Eq. 6-47/6-48 — reference only".
- Note: load applied on the seat plate at `e`; the stiffener free edge is the hypotenuse.

### 4.6 Welds to the support (`attach = welded`)
Model (basis of Manual Tables 10-6 and 10-8, Blodgett §5.3): two L-shaped weld lines, one each side of the stiffener (or one at each end of the angle's vertical leg), vertical length `l = wLen`, top return `h = wRet`. Reaction at `e = eSeat` out of the weld plane. Elastic line-weld properties per L (unit throat):
- `ȳ = (l²/2 + h·l)/(l + h)` from the bottom, `I = l³/12 + l(l/2 − ȳ)² + h(l − ȳ)²`, `c_top = l − ȳ`, `S_top = I/c_top`.
- Group: `n_lines = 2·stN` (two lines per stiffener plate; two for a seat angle), `S = n_lines·S_top`, shear area `A_v = n_lines·l` (vertical welds only; the compression side bears on the support so the top fiber governs).
- `fb = Ru·e/S`, `fv = Ru/A_v`, `f_r = √(fb² + fv²)` kip/in.
- Capacity per inch: `φrn = 0.75·0.6·Fexx·0.707·w`; with `wDir` on, multiply by `1 + 0.5·sin^1.5 θ_r`, `θ_r = atan(fb/fv)`.
- **Seat-to-support weld**: `dc = f_r/φrn`. Detail also reports the required size `D = 16·f_r/(0.75·0.6·Fexx·0.707·kt)` in sixteenths (`kt` = 1 unless the directional increase is selected), and the equivalent table strength `φRn = φrn/(f_r/Ru)`.
- **Minimum fillet size** (Table J2.4, thinner part of seat element and support): REVIEW if `w` below.
- **Maximum fillet size** (J2.2b(b)): along an edge of the seat element, `w ≤ t` for `t < 1/4`, else `w ≤ t − 1/16`. REVIEW if exceeded.
- **Support base metal** (Manual Eq. 9-2 / 9-3): `t,min = 3.09·D/FuSup` one-sided, `6.19·D/FuSup` when `bothSides`; `dc = t,min/supT`. `D` = weld size in sixteenths.
- **Seat element base metal at the weld**: angle vertical leg (single-sided) `3.09·D/FuSeat`; stiffener (welded both sides) `6.19·D/FuSeat`; `dc = t,min/t`.
- Angle: vertical welds at both ends of the vertical leg; `wRet` is the return along the top of the leg (Manual minimum 2w; default 0.2·l reproduces Table 10-6).
- Stiffened: `wRet` is the seat-plate-to-support weld each side (Manual minimum 0.2·L). A note flags when `wRet < 0.2·l`.

### 4.7 Bolts to the support (`attach = bolted`)
Table J3.2 values: A307 `Fnt 45 / Fnv 27`; Group A `Fnt 90`, `Fnv 54 (N) / 68 (X)`; Group B `Fnt 113`, `Fnv 68 (N) / 84 (X)`. `Ab = π·d²/4`. Standard hole `dh` per Table J3.3 (`d + 1/16` up to 7/8 in., `1 1/8` for 1 in., `d + 1/8` above).
Section numbers are 360-22 (§J3.7 strength of bolts, §J3.8 combined tension and shear, §J3.11 bearing and tearout, §J3.4 spacing, §J3.5 edge distance); the Design Examples cite the 360-16 numbering, which is one lower.
- **Bolt shear** (§J3.7, Eq. J3-1): `φRn = 0.75·Fnv·Ab·bN` vs `Ru`. Manual practice for seated connections (Tables 10-5, 10-7): shear only.
- **Bolt spacing and edge distance** (§J3.4, §J3.5 Table J3.4): `pitch ≥ 2.67·d` when more than one row; `bLe ≥ Table J3.4 minimum` (3/4 in for 1/2 in bolts … 1.25d above 1 1/4 in); `bLeSup` likewise when given. PASS or REVIEW (lesser distances need EOR approval per Table J3.4 note a); no D/C.
- **Bearing and tearout on the seat element** (§J3.11, Eq. J3-6a bearing, J3-6c tearout, deformation a design consideration): per bolt `rn = min(2.4·d·t·Fu, 1.2·lc·t·Fu)`, `lc = bLe − dh/2` for the edge row, `bPitch − dh` for interior rows; `φ = 0.75`; sum over bolts.
- **Bearing and tearout on the support**: same, with `supT`, `FuSup`, `bLeSup` (blank → bearing only).
- **Bolt tension + shear** (§J3.8; always for stiffened seats, for seat angles only with `bTension`): `M = Ru·e`; bolt rows at heights `y_i` above the bottom edge of the seat element (from `bLe`, `bPitch`, `bRows`); `T_i = M·y_i/(Σ y_j²)·(1/bolts per row)`; `frv = Ru/(bN·Ab)`; `F'nt = 1.3·Fnt − Fnt·frv/(0.75·Fnv) ≤ Fnt` (J3-3a); `φrnt = 0.75·F'nt·Ab`; `dc = max T_i/φrnt`. If `F'nt ≤ 0` (shear stress beyond `φFnv`, which the bolt-shear row already fails) the row is `FAIL` with `dc = null` and the note "no tension capacity at this shear stress". Prying not evaluated — stated in the row note.
- Seat element for bolts: angle vertical leg, or the vertical plate / tee stem of a stiffened seat (`stT` used).

### 4.8 Validation (blocking errors, red box, no results)
NaN or ≤ 0 on any required numeric (including beam `bf`, and seat plate `t` and `B` for stiffened seats; bolt gage is drawn only and not validated); `bLeSup ≤ dh/2` when given; `bPitch ≤ dh`; `OSL ≤ setback + underrun`; `W ≤ setback + underrun`; `wLen ≤ 0`; `e ≤ 0`; `stA ≤ 0` (tri); `bN < 1`; `bRows·(bolts per row) ≠ bN` (bolts per row = `bN/bRows` must be an integer); `bLe ≤ dh/2`.

## 5. Results section

1. Summary banner: PASS (all `dc ≤ 1`, no FAIL) / FAIL / REVIEW (only advisory rows exceed). Shows the governing row and max D/C.
2. Demand cards: `Ru`, `lb,min`, `lb,prov`, `e`, weld `f_r` or bolt shear per bolt, stiffener `θ`/`λ`/`Fcr` (tri).
3. Section-property table for the beam and the seat.
4. Check table grouped by section rows: Beam · Seat · Attachment · Support. Each row with `▶ Calc` panel: code reference, symbolic equation, substituted numbers, green result, D/C.
5. Engineering notes: assumptions (setback/underrun, 0.8W, top-fiber weld model, shear-only bolts), what is not checked (top angle, beam-to-seat bolts, column web local checks for stiffened seats on webs — refer to Manual Part 10 and Sputo & Ellifritt 1991, stiffened-seat seat plate thickness), and the PCI cross-check caveat.
6. `AREv2.publish([...])` with `Ru`, `lb,min`, governing D/C.

## 6. Schematic (inline SVG, hand-built, redraws on any input change)

Revision 2026-09-08 (Nick's markup): the beam is a true elevation resting on the seat plate, flanges and web, running to the right edge of the panel and ending in a break line. The section panel shows the seat plate and the stiffener stem (or the angle legs) only, never the beam, with bolt holes as circles one each side of the stiffener at gage `g` and at the row depths; welded seats show no holes.

Elevation: support face as a hatched vertical band; beam end with setback and underrun dimension; seat (angle or seat plate + stiffener drawn to the entered proportions); reaction arrow `Ru` at `e` from the support face; `lb` bracket; for `tri`, the free edge with `a`, `b`, `θ` and the section B-B trace; for welds, the L-shaped weld lines highlighted with `l`, `h`; for bolts, bolt symbols at the row heights. A second small panel shows the section through the seat (angle legs or seat plate + stiffener plates). Uses `AREv2.getMark()` for the title text when present.

### 6.1 Results freshness
Any input change after a run re-runs the checks automatically (debounced) so the check table, banner and schematic never disagree. A blocked run (validation errors) clears the banner, cards and table so the print stylesheet cannot show stale results next to the error box.

## 7. Toolbar, state, print

- Mark and Project come from `are-utils-v2` (no calc-local fields).
- All inputs have ids; selects normalized via `AREv2.normalizeSelects` if any select values are non-canonical.
- Print CSS from the template (details expanded, toolbar hidden).

## 8. Testing

- `?selftest=1` runs the fixtures in §9 through `SEAT.compute` and prints PASS/FAIL per fixture in a `<pre>`; document title becomes `SELFTEST PASS n/n`.
- `tools/test-seated-connection.mjs` extracts the `SEAT` script block from the HTML, evaluates it in a VM with no DOM, runs the same fixtures, exits 1 on failure. Added to `npm run qa`.
- Browser verification: serve `public/` on the static server, load the calc, run default inputs (II.A-14 case), screenshot, check console clean, exercise each `seatType`/`attach` combination once, and run `?selftest=1`.
- `node tools/derive-coverage.mjs` must pass after adding the file.

## 9. Fixtures (from the AISC v15.1 Design Examples and PCI DH 7th Ed.)

| Id | Source | Inputs | Expected | Tol |
|---|---|---|---|---|
| F1 | II.A-12A | W16X50, Fy 50, Ru 54.8 | `lb,WLY = 0.311`, `lb,min = 1.03` | ±0.01 |
| F2 | II.A-12A | L6×4×5/8 × 8, `lb,req = 1.0625` | OSL flexure `φRn = 90.0` | ±0.3 |
| F3 | II.A-12A | 4 × 3/4 in. Group A-N; angle t 5/8 Fu 58; support tw 0.440 Fu 65; `bLe = 3` so tearout does not govern (the example states it does not control) | bolt shear 71.6; bearing angle 196; bearing support 155 (exact 0.75 × 205.9 = 154.4; the example rounds 206 × 0.75) | ±0.5; support ±0.7 |
| F4 | II.A-13 | W21X62, Ru 54.8; L8×4×5/8 × 8, `lb,req = 1.125` | `lb,min = 1.12`; OSL flexure 81.0 | ±0.3 |
| F5 | II.A-13 | weld 5/16, `l = 8`, `h = 1.6`, `e = 3.2` | seat weld `φRn = 66.9` (Table 10-6: 66.7) | 66.0–67.5 |
| F6 | II.A-16 | L7×4×5/8, weld 5/16, `l = 7`, `h = 1.4`, `e = 3.2` | `φRn = 53.5` (Table: 53.4) | 52.8–54.0 |
| F7 | II.A-14 | W21X68, Ru 125 | `W,min` crippling 6.93 (J10-5b), yielding 3.59; `lb/d = 0.296` at W 7 | ±0.03 |
| F8 | II.A-14 | stiffener 5/8 × 7 × 15, weld 5/16, `h = 3`, `e = 5.6` | `φRn` between 130 and 139 (Table 10-8: 139; the vertical-weld-only shear distribution gives 130.8, the table's 139 is reproduced if the returns also carry shear); `t,min = 0.625` (2w) and `0.597` (web) | as stated |
| F9 | II.A-15 | column web tw 0.440, Fu 65, D 5 | `t,min = 0.238` one-sided, `0.476` both sides | ±0.003 |
| F10 | II.A-23 | tri: a 18, b 11.5, e 8.25, t 0.375, Fy 36, 2 plates, Ru 54 | `θ = 32.6°`, `a' = 21.4`, `b' = 9.70`; A-A `φMn = 1970` vs `Mu = 446`; B-B `Vu = 29.1` vs `φVn = 157`; `λ = 1.17`, `Q = 0.771`, `Fcr = 27.8`; `Nu = 45.5`, `φNn = 182`; `Mu = 225`, `φMn = 441`; interaction 0.760 | 1 % |
| F11 | II.A-22 | b' 12.1, a' 25.1, t 0.375, Fy 36 | `λ = 1.43`, `Q = 0.636`, `Fcr = 22.9` | 1 % |
| F12 | PCI 6.6.7.1 | b 8, a 10, t 0.375, Fy 36 | `z = 0.315`, `φVn = 28.9` | ±0.002 / ±0.1 |
| F13 | baseline | defaults (II.A-14 case) | banner PASS, no errors | — |
| F14 | NaN guard | `Ru = NaN` | blocking error | — |

## 10. Out of scope (stated in the page notes)

Top stability angle design; beam-to-seat bolts; column web local yielding/crippling and the Sputo–Ellifritt limits for stiffened seats on column webs; seat plate bending; block shear of the beam flange (structural integrity, Ex. II.A-12B); PCI insert/stud anchorage; ASD.
