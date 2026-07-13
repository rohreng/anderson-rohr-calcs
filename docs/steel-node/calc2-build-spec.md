# Calc 2 — Build Spec: Brace Connection at Column-on-Beam Node

**File built:** `public/Calcs/brace_connection_at_column_on_beam_calculator.html`
**Basis:** AISC 360-22 LRFD; AISC Design Guide 29 (UFM); AISC Design Guide 24 Ch. 7 (HSS
walls); Fortney & Thornton EJ 2017 (chevron — see `calc2-chevron-spec.md`).
**Shape data:** AISC Shapes Database v16.0 subset, embedded (copied from existing repo calcs;
W k_des / Zx / Sx / Ix added from v16.0).

This spec lists every limit-state equation with φ factor and validity limit the calculator
implements. Where a step is impossible as written in the frozen plan, the closest faithful
version is implemented and the deviation is noted in §9.

---

## 1. Load-case matrix (frozen "Global engineering rules")

Two signed brace cases entered from RISA, each enveloped independently per limit state:

- **Tension case:** `Pu_brace,T` acts along the brace pulling away from the node.
  Components: `Hb = Pu·cosθ`, `Vb = Pu·sinθ` (θ = brace angle from horizontal).
- **Compression case:** `Pu_brace,C` pushes toward the node; components reverse sign.

Every check computes a demand for **each** case and reports the governing (max D/C) case.
The chevron check sets `ΣHt`, `ΣVt` from the case components. `NaN`/non-finite intermediate →
blocking error; never a silent PASS. **Hard-validation sweep in `computeAll()`:** every
gathered model-(a) numeric must be finite; positivity enforced where physically required
(`tg, Lg, lw, lb_col, tst, bst, Apb, wweld, wbr, wst, FEXX, Fy*, Fu*, Agr, tr, Br, Hr, wb,
Lcavg`); geometric domain: `slot_gap ≥ tg` (slot must clear the gusset) and `slot_gap < Br/2`;
`0 < θ < 90°`; `Lfg ≥ 0`; `0 ≤ xcol ≤ L`; `0 < xwp < L`. Violations are blocking errors —
never NaN rows. (fixtures `C2-VAL-1`, `C2-VAL-2`.) The overall banner's Max D/C includes ALL
finite D/C values, including REVIEW/info rows.

## 2. Model toggle

- **(a) Gusset-to-beam only — DEFAULT and only design-value model.** Load path: brace → gusset
  → gusset-to-beam weld → beam web/flange. Gusset-to-HSS-column interface carries **no** design
  load; its checks are printed **omitted-with-reason**. Any physical clip to the column is
  detailed non-load-bearing.
- **(b) UFM with column stub — EXPLORATORY.** Hard-gated: requires complete through-plate
  geometry (`tp_thru`, `Bp_thru`, `Lp_thru`, weld size, continuity-through-base-plate flag). If
  any is blank/invalid → **blocked, no results** (fixture `C2-GATE-1`). When complete, designs
  every UFM segment (below), but **every output row is labelled "EXPLORATORY — NOT DESIGN
  VALUES,"** the banner can never read plain PASS (a permanent REVIEW gate is injected), and a
  watermark note states the UFM force distribution assumes a continuous column and its extension
  to a terminating stub is an engineering model, not validated mechanics (fixture `C2-GATE-2`).

## 3. Brace-side limit states (slotted HSS welded to gusset)

Let `Fy_b`, `Fu_b` = brace steel; `Ag` = gross area; `t` = HSS design wall; `lw` = weld/slot
engagement length along the brace axis.

1. **Gross yielding (§D2(a)):** `φPn = 0.90·Fy_b·Ag`.
2. **Net-section rupture w/ shear lag (§D2(b), §D3, Table D3.1 Case 5 — AISC 360-22,
   p.16.1-34):** `φPn = 0.75·Fu_b·Ae`, `Ae = An·U`. Net area `An = Ag − 2·(t·slot_gap)` (two
   slot cuts through the wall for a single concentric gusset; `slot_gap = tg + 2·(1/16)"`
   clearance, editable). 360-22 Case 5 covers round AND rectangular HSS with a single
   concentric gusset through slots (360-22's Case 6 is two side gusset plates — not this
   detail; the superseded 360-16 Case 5/6 forms are no longer used).
   - **Rectangular HSS (Case 5, 360-22):**
     `x̄ = b − (2b² + t·H_t − 2t²)/(2·H_t + 4b − 4t)`, `U = 1 − x̄/lw`, where `H_t` = HSS
     dimension IN the plane of the connection (UI `Br`, "∥ gusset"), `B_t` = dimension
     perpendicular (UI `Hr`), `b = B_t/2` for a concentric gusset, `t` = design wall.
   - **Round HSS (Case 5, 360-22):** `x̄ = R·sinθ/θ − tp/2` (θ in rad, `tp` = gusset `tg`),
     `U = [1 + (x̄/lw)^3.2]^(−10)`, with `θ = (π − 2·asin(slot_gap/D))/2` (half-arc of each
     connected shell segment). There is **NO** `U = 1.0` shortcut at `lw ≥ 1.3D` in 360-22
     (the old rule is unconservative). The `lw < D → reject` gate is retained as a
     **conservative scope retention** (not a Case-5 rule).
   - Domain validation both branches: `0 < U ≤ 1` and `x̄ ≥ 0` required, else blocking error
     (unsupported arrangement) — never a negative capacity. (fixtures `C2-U-1`/`C2-U-2`
     rect-vs-round distinct expressions at lw=8; `C2-U-3` rect U=0.787819, `C2-U-4` round
     U=0.94515 at lw=10, hand-derived.)
3. **Slot-end / weld-line block shear on the brace wall (§J4.3):**
   `φRn = 0.75·[ 0.60·Fu_b·Anv + Ubs·Fu_b·Ant ]  ≤ 0.75·[ 0.60·Fy_b·Agv + Ubs·Fu_b·Ant ]`,
   `Ubs = 1.0` (uniform tension). Failure block = the two shear planes along the weld lines,
   tension plane across the slot end. `Agv = 2·lw·t`, `Anv = Agv` (welded, no holes),
   `Ant = t·(net width across slot end)`.
4. **Brace-to-gusset weld group (§J2.4):** four longitudinal fillet lines × `lw` (slotted HSS
   over gusset — both walls, both faces), weld size `w_br` (input, default 1/4").
   Longitudinal → **no** directional increase (`kD = 1.0`):
   `φRn = 4·lw·0.75·0.60·FEXX·0.707·w_br`. Demand = `Pmax` (envelope). Concentric slotted
   detail → no weld-group eccentricity; `e ≠ 0` arrangements out of scope (printed).
   (fixture `C2-BW-1`: φRn = 222.7 kips at defaults.)

## 4. Gusset limit states

Let `tg` = gusset thickness, `Fy_g`, `Fu_g` (A36 default), `lw` = brace-to-gusset connection
(weld/slot engagement) length, `wb` = brace connection width delivered into the gusset.

1. **Whitmore effective width (DG29 / §J4):** `Lw = wb + 2·lw·tan(30°)` — the 30° spread runs
   over the **connection length `lw`**, not the DG29 buckling-length average (`Lc_avg` is used
   ONLY in the buckling `KL/r` below). The Whitmore width is **not truncated** at gusset free
   edges — a printed note tells the engineer to verify the fan fits the plate (geometry not
   modeled). (fixture `C2-WM-1`: Lw = 17.547 in, φRn,yield = 284.26 kips at defaults.)
2. **Whitmore yielding (§J4.1):** `φRn = 0.90·Fy_g·(Lw·tg)`.
3. **Whitmore net rupture (§J4):** `φRn = 0.75·Fu_g·(Lw·tg)` when a net section governs
   (welded gusset → info row, gross yielding governs).
4. **Whitmore buckling — compression brace (DG29):** effective length
   `Lc_avg = (L1 + L2 + L3)/3` (DG29 three-line average from the Whitmore section to the gusset
   boundary), `KL = K·Lc_avg` with **K = 0.6** for a gusset supported on two edges (beam +
   stiffener), **K = 1.2** for an extended/free-edge gusset (DG29 boundary-condition table;
   selectable, default 0.6 for the two-edge node). Radius of gyration `r = tg/√12`.
   Branch implemented explicitly: `KL/r ≤ 25` → **§J4.4** (`φPn = 0.90·Fy·Ag_w`, no buckling
   reduction); else `φcPn = 0.90·Fcr·Ag_w`, `Ag_w = Lw·tg`, `Fcr` per §E3
   (`Fe = π²E/(KL/r)²`; `Fy/Fe ≤ 2.25 → Fcr = 0.658^(Fy/Fe)·Fy`; else `Fcr = 0.877·Fe`).
   The printed detail states which branch governed.
5. **Gusset block shear (§J4.3):** block = two shear planes along the weld lines on the gusset
   + tension across between them: `Agv = Anv = 2·lw·tg`, `Ant = wb·tg`, `Ubs = 1.0`,
   `φRn = 0.75·[min(0.6·Fu_g·Anv, 0.6·Fy_g·Agv) + Ubs·Fu_g·Ant]`. Demand = `Pmax` (envelope).
   (fixture `C2-GBS-1`: φRn = 292.5 kips at defaults.)
6. **Gusset free-edge buckling / stiffening:** free-edge length `Lfg` vs
   `0.75·√(E/Fy)·tg` — **classical unstiffened-edge criterion (Astaneh)**. DG29 contains no
   free-edge length limit (DG29 App. C uses the AFMM, which is not modeled here; citation
   corrected). Exceeded → REVIEW (edge stiffener required) with the limit printed; not an
   auto-FAIL (edge stiffener is a detailing remedy). (fixture `C2-FE-1`: limit = 10.643 in at
   tg=0.5/Fy=36.)

## 5. Gusset-to-beam weld (DG29, §J2.4)

- Resultant interface force per unit length from the enveloped `ΣH`, `ΣV`, and interface moment
  `Ma-a` distributed over `Lg` (elastic vector sum of the normal + shear + moment-induced
  components at the weld end):
  `fh = ΣH/Lg`, `fv = ΣV/Lg`, `fm = 6·Ma-a/Lg²` (peak from linear moment distribution),
  `fr = √( (fv + fm)² + fh² )`  [kip/in], enveloped over cases.
- **DG29 weld ductility factor = 1.25**, applied **once** to the resultant demand `fr` (DG29
  §3 / Thornton: welds proportioned for 1.25× the peak so the weld does not fracture before the
  gusset redistributes). Design weld demand `fr_d = 1.25·fr`.
- Fillet capacity per unit length (§J2.4, directional strength increase):
  `φrn = 0.75·0.60·FEXX·(1 + 0.50·sin^1.5 θw)·(0.707·w)` per line, ×2 for a two-sided fillet.
  `θw = atan2(fv + fm, fh)` — the ACTUAL angle of the resultant to the weld axis (the
  resultant has a longitudinal component `fh`; the former pinned `θw = 90°` factor 1.5 is
  removed). D/C `= fr_d / (φrn)`. (fixture `C2-WLD-1`: θw = 72.90°, kD = 1.4672,
  φrn = 20.423 k/in, D/C = 0.8585 at defaults.)

## 6. Combined web-region J10 (§J10.2 / §J10.3) — conservative rule (frozen)

Column `Pu` (from Calc 1) is a **manual input**. Brace vertical component `Vb` lands on the beam
web at the gusset. Per the frozen rule:

- **Web local yielding (§J10.2):** `φRn = 1.00·Fyw·tw·(C·k_des + lb)`, `C = 5` interior
  (`x ≥ d` from member end), `C = 2.5` at/near member end (`x < d`). φ = 1.00.
- **Web local crippling (§J10.3):** φ = 0.75.
  - Interior (`x ≥ d/2`):
    `Rn = 0.80·tw²·[1 + 3·(lb/d)·(tw/tf)^1.5]·√(E·Fyw·tf/tw)`.
  - Near end (`x < d/2`): `lb/d ≤ 0.2` →
    `Rn = 0.40·tw²·[1 + 3·(lb/d)·(tw/tf)^1.5]·√(E·Fyw·tf/tw)`;
    `lb/d > 0.2` →
    `Rn = 0.40·tw²·[1 + (4·lb/d − 0.2)·(tw/tf)^1.5]·√(E·Fyw·tf/tw)`.
- **Combination rule (no invented dispersion criterion):**
  - Patches **concentric / fully coincident** — `|xcol − xwp| ≤ 0.5 in` AND
    `|Lg − lb_col| ≤ 0.5 in` (same centroid AND same footprint) → demands
    summed algebraically (`Pu_col + Vb`) and checked against the **single** capacity of that
    footprint. Clean PASS/FAIL allowed. (Page defaults, Lg=24 vs lb_col=8, are NOT coincident
    and take the conservative-bound branch — expected.)
  - **All other configurations** → conservative bound: summed demand vs the **weakest applicable
    single-patch capacity** (smallest `N`, most adverse position, most adverse crippling branch)
    **plus a mandatory REVIEW flag** ("AISC J10 gives no interaction rule for non-coincident
    concentrated forces"). Never a plain PASS.
  - Enveloped over brace T and C (C relieves web when `Vb` opposes `Pu_col`; the governing case
    is the one maximizing summed compression on the web).

## 7. Beam axial + flexure (§H1)

- Collector/axial force = interface horizontal resultant `ΣH_T`, taken in the **bare steel
  section** (conservative, documented — the composite slab is blocked out at the node).
  `Pr = ΣH_T` (enveloped), `Pc = φc·Fy·Ag_beam` (§E, `φc = 0.90`; braced-length effects are a
  RISA input if the collector is in compression — user `Pc` override allowed).
- `Mr` = global `Mu` (RISA input) **+** chevron local `Mmax` where the gusset region coincides
  with the beam max-moment region (sign-enveloped); else the two are checked separately (the
  larger governs), documented. `Mc = 0.90·Fy·Zx`.
- **§H1-1:** `Pr/Pc ≥ 0.2 → Pr/Pc + (8/9)(Mr/Mc) ≤ 1.0`; else `Pr/(2Pc) + Mr/Mc ≤ 1.0`.
- **Pc-default REVIEW gate (deviation D-3 retained):** the collector always envelopes a
  compression case; when `Pc_ovr` is not entered the default `Pc = 0.90·Fy·Ag` is a YIELD
  value, not a Chapter E compression capacity — a passing ratio with the defaulted Pc reports
  **REVIEW** (note: "Pc defaulted to φFyAg (yield); enter RISA/Ch.E Pc for a design value").
  FAIL stays FAIL. (fixture `C2-H1-1`.)

## 8. Stiffener / gusset single-element design (frozen — final detail)

The stiffener under the column (Calc 1, preliminary) and the gusset boundary are ONE element.
Calc 2 re-runs the full stiffener set under the enveloped combined cases PLUS the dual-purpose
combined-stress checks. Printed note: *this*, not Calc 1's preliminary sizing, is the final
detail.

**Full stiffener limit-state set:**
1. **Stiffener local (plate) yielding / cruciform column (§J10.8):** stiffener pair + web strip
   as a compression member, **effective length `0.75·h`** (h = clear web depth), cross-section =
   two stiffeners + a web strip of `25·tw` (interior) or `12·tw` **at the ends of members**
   (spec p.16.1-223). Branch convention: `xcol < d/2` → end (12·tw); else interior (25·tw);
   the governing branch is printed. `φcPn` per §E3. (fixture `C2-CR-1`: end branch
   Ast = 4.0123 in² at defaults geometry with xcol=4.)
2. **Stiffener bearing (§J7):** `φRn = 0.75·1.8·Fy·Apb`, `Apb` = contact area at the fitted end
   (finished-to-bear).
3. **Width-thickness (§J10.8 / Table B4.1):** `bst/tst ≤ 0.56·√(E/Fy)` (unstiffened element).
4. **Stiffener-to-web weld (§J2.4):** two-sided fillets on two stiffeners, length `0.9·h` each
   side per stiffener → 4 lines × `0.9h`, `kD = 1.0` (transverse increase conservatively
   omitted). Demand = the transmitted difference per §J10.8:
   `max(0, ΣP − min(φRn,J10.2, φRn,J10.3) single-patch at the column location)`.
5. **Stiffener-to-flange weld (§J2.4):** 4 lines × `bst`, `kD = 1.0`; demand = full ΣP
   (conservative). (fixture `C2-STW-1` pins items 4–5 + the shared-line check.)

**Dual-purpose combined-element model (blocking pre-build derivation, §8.1):** see below.

### 8.1 Dual-purpose combined-stress model + independent validation

The single plate simultaneously (i) bears the column patch load transverse to the beam web
(in-plane-of-web transverse stress `σ_bearing = P_col / (Aeff_bearing)`), and (ii) carries the
gusset in-plane axial/flexural stress from the brace (`σ_gusset = ΣH/(tg·Lg) ± 6·Ma-a/(tg·Lg²)`,
and shear `τ = ΣV/(tg·Lg)`). These act on the **same** plate cross-section, so a combined-stress
(von Mises) interaction governs, not either check alone:

    σ_vm = √( σ_gusset² − σ_gusset·σ_bearing + σ_bearing² + 3·τ² )   ≤   φ·Fy   (φ = 0.90)

(the `−σ_gusset·σ_bearing` cross term is the plane-stress von Mises reduction; conservative to
retain it only when the two normal stresses have the same sign — the calc takes the **worse** of
same-sign and opposite-sign assembly and prints which.)

**Stability of the combined element:** the transverse bearing load can buckle the free
(un-welded) edge of the combined plate; checked with the DG29 free-edge limit of §4.6 using the
*combined* demand, and with the §J10.8 cruciform effective length `0.75h` under the *summed*
axial. If the free edge exceeds the limit under combined load → REVIEW (edge stiffener).

**Shared-weld interaction (NUMERIC row):** where the stiffener-to-web weld and the gusset-to-beam
weld share a line, the two per-unit-length demands are **vector-summed** before the §J2 capacity
check (`fr_shared = √( (fv_gusset + fm + fv_stiff)² + (fh_gusset)² )`,
`fv_stiff` = stiffener-to-web demand / (4·0.9h)), so the shared weld is not counted twice at full
capacity for each role. `fr_d = 1.25·fr_shared` (DG29 ductility, once); capacity per §J2.4 with
`kD` at the resultant angle; status from D/C (no longer an info-only row).

**Independent validation:** `docs/steel-node/validate-dualpurpose.mjs` reproduces the von Mises
interaction against a hand solution for a known biaxial stress state (Boresi/Timoshenko plane
stress) and against the degenerate cases (`σ_bearing = 0` → pure §J4 gusset yield;
`σ_gusset = τ = 0` → pure §J7 bearing) — asserts the combined check reduces exactly to the
single-role checks at the limits, and matches the closed-form von Mises value within 0.1%.

## 9. DG24 Ch. 7 / §K1 limit states — model (b) only (EXPLORATORY)

Longitudinal through-plate to rectangular HSS wall. `t` = HSS wall, `B`, `H` = HSS width/height,
`tp` = through-plate thickness, `N` = plate bearing length along HSS axis, `θ` = plate load
angle. `Qf` = chord-stress interaction per **AISC 360-22 Eq K1-3** (longitudinal plate
connections): `Qf = 1.0` when the HSS wall is in tension; when in compression
`Qf = 1 − 0.3·U·(1+U) ≤ 1.0`, `U = Pro/(Ag·Fc) + Mro/(S·Fc)`. (The former `1 − U²` form was
wrong for this connection type; U=0.3 → Qf = 0.883, fixture `C2-QF-1`.)

1. **HSS wall plastification — through-plate (DG24 Table 7-2, Spec §K1, based on K1-9 ×2 for a
   through-plate):**
   `φ·Rn·sinθ = 1.00 · [ 2·Fy·t² / (1 − tp/B) ] · ( 2·N/B + 4·√(1 − tp/B) ) · Qf`.
   (Single non-through plate uses the ×1 form K1-9; model (b) mandates a through-plate so the
   ×2 form is used.)
2. **HSS sidewall local yielding (Spec §K1.6 / DG24 Table 7-2):**
   `φRn = 1.00·2·Fy·t·(5·tp + N)` when `5·tp + N < B`; else `φRn = 1.00·Fy·A_wall`.
3. **HSS wall punching shear — DG24 Ch.7 perimeter model (exploratory):**
   `φRn = 0.75·0.60·Fy·t·(2·N + 2·tp)` (perimeter of the plate footprint). This is a perimeter
   shear MODEL, not a line-item §K1 equation; row reference reads "DG24 Ch.7 perimeter model
   (exploratory)" with a printed applicability note (non-slender walls per §B4.1;
   plate-thickness limits per K1-10 — engineer to verify).

**Validity limits (DG24 Table 7-2A) — out of range BLOCKS model (b):**
`θ ≥ 30°`; `B/t` and `H/t ≤ 40` (longitudinal branch-plate / through-plate walls, §K1.4b);
`Fy ≤ 52 ksi`; `Fy/Fu ≤ 0.8`; HSS wall non-slender per §B4.1 for punching. Any violation →
blocking error with the offending limit printed (model (b) cannot silently run out of range).

## 10. Transfer force to beam-end connections (Dowswell)

Transfer force `= ΣH_T` (collector) delivered to the beam-end connections computed from the
user's Dowswell input forces; **delivery to the end connections is a REVIEW gate** (the calc
does not design the far end connections). Printed with the required transfer force.

## 11. Three-state output + provenance

- Banner: any FAIL → **FAIL**; else any open REVIEW gate → **REVIEW REQUIRED (n items)**; else
  **PASS**. Model (b) always injects a REVIEW gate → never plain PASS.
- Provenance footer: `Brace Connection at Column-on-Beam Node v1.0.0 | AISC 360-22 LRFD | AISC
  Shapes v16.0 | SHA-256: UNSTAMPED`, date, Node ID, active assumptions.
- Shared-node identity block: Node ID / project / revision + deterministic input-fingerprint
  hash (FNV-1a over the shared inputs, printed hex) matching the sibling calcs.

## Deviations from the frozen plan (with reasons)

- **D-1 (chevron single-sided reduction):** the paper derives the two-gusset (top+bottom)
  chevron model; this node has a single top-side gusset. The calc runs the faithful reduction
  (`ΣVb = ΣHb = 0`), which the validator confirms preserves every governing equation. No change
  to the mechanics — the omitted bottom terms are identically zero.
- **D-2 (model (b) K1 fidelity):** the published §K1 equations are for a plate framing to a
  *continuous* HSS. Applying them to a terminating stub is exactly the un-validated extension the
  frozen plan flags; hence model (b) is EXPLORATORY / permanent-REVIEW and never a design value.
  The equations are implemented faithfully with their DG24 validity gate; the *topology* judgment
  is handed to the engineer, as the plan requires.
- **D-3 (§H1 collector compression capacity):** buckling length of the collector in compression
  is a global property RISA owns; the calc exposes a `Pc` override and defaults to `0.90·Fy·Ag`
  (yield) with a printed note rather than inventing a `KL/r`. A passing ratio with the
  defaulted Pc now reports REVIEW (see §7).
- **D-4 (Act4 re-review — demo-default statuses):** at the page's demo default loads
  (Pu_col=100, Pu_T=120, Pu_C=140 on W18X50) several rows legitimately FAIL: §H1 interaction
  (ratio 1.854, chevron Mloc = 8085 k-in vs Mc = 4545), the non-coincident combined-J10
  conservative bound (dem 199.0 k vs end-branch caps 185.1/102.4 k), the cruciform column
  (181.9 k), and the new stiffener-to-flange weld (55.7 k with 1/4" welds). These are
  load-driven demo values, not calculator errors; fixtures `C2-H1-1` and `C2-J10C-1` exercise
  the REVIEW branches at reduced loads and pin the defaults' FAIL statuses.
