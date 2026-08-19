# Plan: Steel Channel Lintel at a New Opening in Existing Masonry — ARE Web Calc
_Locked via grill — by Claude + Nick Rohr, 2026-08-19 · **rev 12** after Codex Rounds 1-7, two Fable reviews, and user sign-off on the wind basis_

Deliverable: `public/Calcs/masonry_opening_channel_lintel_calculator.html`, a self-contained
ARE web calculator for a pair of thru-bolted steel channels carrying a new opening cut into an
existing CMU wall, registered in `app/lib/calcs.ts` as slug `masonry-opening-channel-lintel`.

Reference precedent supplied by the user: a Tedds calc, "LINTEL 1 — Design of New Opening In
Masonry Wall" (MC18x42.7, 28 ft opening, 8" CMU, f'm = 1900 psi, 3/4" A307 thru-bolts at 16" o.c.,
4 jamb bolts). This plan reproduces its gravity path and materially extends it.

---

## Goal

Build an AISC 360-22 (LRFD) + TMS 402-22 (strength design) calculator for a matched pair of steel
channels, one on each face of an existing CMU wall, thru-bolted through newly grouted cells above a
cut opening. The channels carry the wall weight plus superimposed gravity load over the opening,
**By default the two channels act INDEPENDENTLY**, each resisting its allocated share of out-of-plane
wind in weak-axis bending. Composite action about the wall centerline — the two channels developing an
axial couple through the thru-rods acting as transverse beams on a grout foundation — is a **separate,
separately qualified, informational-only mode** that requires a welded connector and is excluded from
design pass/fail (see §Two modes). Load reaches the
channels only through bolt bearing; end reactions are delivered into grouted CMU jamb piers by bolt
groups, and the piers are checked for combined axial and out-of-plane flexure. The calc must
reproduce the reference Tedds gravity results within 2% [Phase 0 gate NOT closed — no 2% claim; see
review log], correct the numerical errors found in it,
and add the composite wind path, connector design, torsion couple, and combined-interaction checks
the reference omits.

---

## Load path (the physical model this calc encodes)

**Gravity**
1. Wall weight + superimposed load above the opening bears **downward on the thru-rod shanks**.
2. The rod bears on the **two channel webs** (AISC J3.10) and is checked in shear (AISC J3.6) at
   **two shear planes**.
3. Each channel spans the opening in **strong-axis bending** (depth vertical, web flat on the wall
   face, flanges projecting away from the wall) — matching the reference's use of I_major = 554 in^4.
4. Load applied at the web is eccentric to the channel shear center, producing a distributed torque
   resisted by the two bolt rows as an out-of-plane couple (see §Torsion below).

**Out-of-plane wind**
5. Wind pressure on the wall strip above the opening is carried by the masonry **spanning
   horizontally between bolt columns** into the rods, then into the channels.
6. **DEFAULT (non-composite) — this is the shipping path.** Each channel independently resists its
   allocated share of the wind moment in **weak-axis bending** (AISC F6). The two channels do not
   interact: **`N_ch = q = V_x = M_wind,rod = k = 0` identically.** Rod demands are gravity-only.

7. **OPTIONAL (welded composite) — informational only, see §Two modes.** The pair resists the wind
   moment as a composite section about the vertical wall-centerline axis, developing an axial couple.
   The longitudinal shear flow is carried by the rod as two single-plane end shears `+V_x` and `−V_x`
   separated across the wall; those form a **net couple `V_x*L_g`**, so the rod bends in double
   curvature and **distributed grout bearing along the grip is required to equilibrate it**. See
   §The connector mechanism. ("Double shear" describes the gravity component only — never this
   longitudinal transfer.)

**Ends**
8. End reactions (vertical + out-of-plane) go into the grouted jamb piers through **bolted
   connections only** — the channels sit on the wall faces and cannot bear on top of the jamb.
9. The grouted pier carries the reaction plus load from above plus its own out-of-plane wind.

---

## Locked decisions (Act 1 grill)

| # | Decision | Resolution |
|---|---|---|
| 1 | Geometry | 8/10/12 nominal CMU wall (t = 7.625 / 9.625 / 11.625 in). Channel web flat on wall face, depth vertical, flanges project away, rods through the web. **Matched pair, one per face** is the base case; a single-channel mode disables composite wind action. |
| 2 | Design basis | **LRFD / strength design.** AISC 360-22 with phi for channels and bolts; TMS 402-22 Chapter 9 for masonry. Deflection at service level. |
| 3 | Gravity loads | Wall rectangle `w_cmu x H_wall` (full, no arching, default); uniform D/L/S/Lr with left+right tributary widths; discrete point loads dispersed per TMS 5.1.1.1 (3V:1H adjacent to an opening) **retained as patch loads**; optional arching reduction OFF by default, banner-warned as non-codified. Enumerated signed ASCE 7-22 LRFD combinations; governing combo reported per check. |
| 4 | Composite section | **Steel-only.** Masonry contributes **no** flexural stiffness. `I_comp = 2*(Iy_ch + A_ch*z_ch^2)`, `z_ch = t/2 + xbar`, NA at wall centerline by symmetry. |
| 5 | Wind demand | User enters ASCE 7 **strength-level** pressure (+/-) in psf, with classification, zone, effective wind area and enclosure recorded as inputs. Tributary height defaults to `H_above/2 + d/2`, overridable. Cross-reference `asce716_cc_wind_calculator`. |
| 6 | Masonry on bolt | Enumerate **every** TMS Chapter 9 bolt limit state (Eq. 9-1 through 9-8) plus TMS 9.1.8 bearing; each either computed or **explicitly dismissed with a stated reason**. Minimum governs; governing mode named. |
| 7 | Bolt layout | **Two rows** (vertical gage `g`), horizontal spacing `s` on the 8" grouted-cell module. Solver **enumerates permitted layouts and re-runs the full check on each** rather than solving modes independently. |
| 8 | Jamb end | **Bolted to jamb face only** — no bearing seat. Bolt group unity-checked; breakout live with group-overlap projected areas. |
| 9 | Jamb pier | TMS 9.3 reinforced strength design, **axial + out-of-plane flexure interaction**. No in-plane pier check — but the in-plane eccentric moment **is computed and reported** for hand-off. |
| 10 | Bracing / LTB | **`L_b` defaults to the FULL SPAN** (rev 5 — rev 4's `L_b = s` default contradicted its own text). `L_b` reduces to the rod column spacing `s` **only after AISC Appendix 6 brace strength AND stiffness are satisfied** at each rod column; same rule for compression `KL` and for the twist restraint credited to the two-row couple. F2.2 with the channel `c` factor of Eq. F2-8b throughout. No separate erection load case; a mandatory installation-sequence block instead. |
| 11 | Deflection (rev 11 — user decision) | **Gravity: `L/600`** at service D+L on `2*Ix`, by superposition — this is TMS 4.6 and it is mandated. **Wind: `L/240` at `0.42W`**, the IBC Table 1604.3 minimum with note (f), on the **non-composite `2*Iy`** default basis. Rev 8-10 used `L/600` at full W on composite; the corrected slip analysis showed that combination is unbuildable without a welded connection (see Decision 14), so the wind target drops to the code minimum, where it passes without any special detail. Composite deflection reported as upside. |
| 12 | Features | Full **72-shape C + MC catalog** with `xbar` and `eo`; **true coupled enumeration** over shapes x `s` x `g` ("Optimize section and layout"), plus a separate fixed-layout "Check my layout" mode; two `are-draw` views; AREv2 save/load/print/publish; `status: "wip"` until sign-off. |
| 13 | Verification | Fixture A (reference reproduction, 2% — [Phase 0 gate NOT closed — no 2% claim; see review log]), Fixture B (longhand hand-check + independent discrete-connector comparison), Fixture C (degenerate, monotonicity, **and explicit equilibrium assertions including local rod-grout closure**). Codex then Fable review. **Gravity transfer between rods IS checked, via the designed reinforced bond beam** (rev 7 — the earlier "not computed" position is superseded by the Phase 6 bond-beam design); the **wind-direction inter-bolt span is also a computed check**. |
| 14 | Composite basis (rev 11 — user decision, supersedes rev 8) | **NON-COMPOSITE is the default design basis for both strength and deflection.** Composite action is computed and reported as **optional upside**, and is available only when the engineer specifies a **positive zero-slip connection** (rod or shear plate **welded** to the channel web) AND the staged engagement check passes. Reamed holes plus an epoxy-filled masonry annulus are **NOT sufficient** — they leave the channel-web hole clearance, which is the interface the longitudinal shear actually crosses, and at the worked case they give `w_slip = 0.151` against `w_w = 0.150 klf`, i.e. no engagement. The base design therefore carries **no contractor-compliance dependency**. |

---

## Two modes — the gate that governs everything below (rev 12)

Rev 11 made non-composite the design basis but left composite-era equations sitting in unconditional
phases, so the document still read composite-first. Codex Round 7 was right that this is an
implementation hazard as much as a documentation one. **Everything below is now explicitly gated.**

```
compositeMode = FALSE          <-- DEFAULT, and the only mode that can produce a PASS
    q = V_x = N_ch = k = M_wind,rod = 0   identically, asserted in Fixture C
    wind        -> each channel, weak-axis F6, on its allocated share
    rod         -> gravity actions only: M_grav, V_y, N_rod = T_w + dF
    grout       -> gravity bearing only
    stability   -> full span, always (App. 6 reductions hard-disabled)
    deflection  -> non-composite 2*Iy, 0.42W vs L/240

compositeMode = TRUE           <-- INFORMATIONAL ONLY. Cannot pass. Cannot optimise.
    everything in §The connector mechanism and Phase 4/5 composite branches
```

**Composite mode ships read-only** (rev 12, Codex Round 7 #7-#11). It produces numbers and no verdict:
no PASS status, **excluded from the auto-designer**, and marked on the sheet as requiring a separately
engineered connection. The reasons are specific and none of them are soluble by more analysis here:

- **There is no weld design.** No AISC J2 strength, weld geometry, channel-web local check,
  eccentricity, or load combination has been developed for the welded connector.
- **Welding the rod is not generically valid.** A307 carries no weldability requirement; A449 is
  quenched-and-tempered and A193-B7 is alloy — both may require material-specific procedures or be
  unsuitable for field welding. A weldable **shear-plate** detail with specified plate and weld metal
  is the right answer, and it has not been designed.
- **A qualified weld has no clearance stage**, so `w_slip = 0` and the staged-slip model does not
  apply to it (rev 11's `c_h ~ 0.001"` for a weld was physically inconsistent — Codex Round 7 #9).
  Staged clearance analysis is for **bearing-type** connectors only.
- **The shear plate is named but not described** — geometry, attachment to both channels, transfer
  through the wall, rod interaction and grout path are all absent.

Enabling composite mode for design is therefore **future work with its own review**, not a checkbox.

---

## The connector mechanism — OPTIONAL COMPOSITE MODE ONLY (rev 9 derivation; gated in rev 12)

This is the heart of the calc and it took three passes to state correctly. The history is kept because
the two wrong versions are the obvious wrong answers and a future reader should see them refuted.

- **Rev 1 said** the masonry was the "shear web" carrying longitudinal shear between the channels.
  Wrong — the rod delivers that force directly, end to end.
- **Rev 2/3 said** the rod is a "direct double-shear connector" and the grout merely provides lateral
  support. **Also wrong, and unconservatively so.** It does not satisfy equilibrium.

**The correct model: the rod is a transverse beam on a grout foundation, loaded by two opposed end
shears.** Channel A applies `+V_x` at `z = +t/2`; channel B applies `−V_x` at `z = −t/2`. Net force is
zero, but the **net moment is `V_x·(t + t_w)`**. Bolt-hole bearing at the webs cannot transmit end
moments, so **distributed grout bearing along the grip is required to equilibrate the rod.** The grout
is therefore a **mandatory participant in the composite load path**, not a support assumption — and
grout bearing stiffness and strength along the rod are design quantities, not commentary.

What the grout does, stated correctly:
- **Bears on the rod under gravity** (the wall hangs on the rods) — TMS limit states.
- **Provides the distributed transverse reactions that equilibrate the rod's double-curvature bending**
  under the opposed longitudinal shears. Without them the rod is not in equilibrium.

**Terminology discipline:** "double shear" is used **only** for the gravity component, which is a
genuine symmetric central-loaded double-shear condition. The longitudinal transfer is described as
**two single-plane end shears coupled through transverse rod flexure and grout bearing** — calling it
double shear overstates capacity.

**The two shear planes are NOT interchangeable — check per plane, not per bolt.** This is the single
most consequential correction from review, and rev 2 still had it wrong:

- **Gravity `V_y`** originates in the masonry *between* the two webs and exits into both channels, so
  each plane carries **half**: `V_y,plane = V_y,bolt / 2`.
- **Wind shear flow `V_x`** is a channel-to-channel transfer: channel A pushes the rod one way at its
  plane, channel B pushes the other way at its plane. **Each plane carries the full `q*s/rows`** —
  there is no halving. Crediting "double shear" against the longitudinal component halves the demand
  and is unconservative.

```
R_plane = sqrt( (V_y,bolt/2)^2 + (q*s/rows)^2 )     checked against SINGLE-plane
                                                     J3.6, J3.10, and TMS Bvn
```

Scale check (canonical — every worked example in this plan derives from this one demand function;
rev 7 corrects a factor-of-two that rev 6 carried in two places): `p = 30 psf`, `h_trib = 5 ft`,
`L = 28 ft`, `s = 16"`, `rows = 2` gives `V_w = 2.10 k`, `q = 0.2129 k/in`, and
**`V_x = q*s/rows = 1.704 k` per rod per plane** against `phi*r_n = 8.95 k` single plane.
(`q*s = 3.41 k` is the demand on the whole rod COLUMN, shared by the two rows — it is not the
per-rod value, and rev 6 wrongly used it as one.)

Consequences that must be built:

1. **The rod-on-grout model, derived rather than asserted** (rev 5 — rev 4 asserted
   `M_rod = V_x*L_u/2` with no boundary conditions AND simultaneously called `L_u` the full grip,
   which is self-contradictory: an unsupported rod cannot equilibrate the end couple. Codex Round 3
   #1/#2/#3 caught this correctly.)

   Grip `L_g = t + t_w` (mid-web to mid-web). Grout bearing is credited over a centred contact length
   `L_c`, leaving an unsupported gap `L_u = (L_g − L_c)/2` at each end representing the face-shell
   zone where the annulus may be imperfectly filled. Loading is **antisymmetric** (`+V_x` at one web,
   `−V_x` at the other), so the grout reaction is a self-equilibrating antisymmetric distribution of
   uniform intensity `±k` over the two contact halves. Statically admissible and closed form:

   ```
   couple equilibrium:   k * (L_c/2)^2  =  V_x * L_g        ->   k = 4*V_x*L_g / L_c^2
   moment entering contact:                M_1 = V_x * L_u
   location of max moment inside contact:  s*  = L_c^2 / (4*L_g)
   MAX ROD MOMENT:                         M_rod = V_x * ( L_u + s*/2 )
   ```

   The model is continuous across both bounds, which is how it is verified:
   - `L_u = 0` (full contact)  ->  `M_rod = V_x*L_g/8`
   - `L_u = L_g/2` (no grout credit)  ->  `M_rod = V_x*L_g/2`, exactly **4x** the full-contact value.

   Worked anchor, 8" wall, `L_g = 8.075"`, **`V_x = 1.704 k`** (canonical value above): full-contact
   mathematical bound `M_wind = V_x*L_g/8 = 1.72 k-in`; at the **physical** bound `L_u = t_w/2 = 0.225"`,
   `L_c = 7.625"`, `s* = 1.800"`, `k = 0.946 k/in`, `M_wind = 1.92 k-in`; no-grout-credit comparison
   value `V_x*L_g/2 = 6.88 k-in`.

   **Physical limit on contact, distinct from the mathematical bound** (rev 6, Codex Round 4 #10):
   grout exists only across the wall thickness `t`, not through the channel webs, so
   **`L_c <= t` and `L_u >= t_w/2` are enforced**. `L_u = 0` is a mathematical limit used only to
   verify the formula, never a design state. Physical maximum contact for an 8" wall:
   `L_u = 0.225"`, `L_c = 7.625"`, `s* = 1.800"`, `k = 0.946 k/in`.

   **The `L_c -> 0` point is singular** (Codex Round 4 #14): `k -> infinity`, so the finite
   `V_x*L_g/2` rod moment there is a *comparison value only* — that state must always **fail** the
   grout-bearing and composite-action checks, and the calc enforces that rather than reporting it as
   a viable design.

   **The uniform `±k` field is a statically admissible lower-bound (plastic) distribution, not an
   elastic response** (Codex Round 4 #13), and is labeled as such. Rev 7 makes the acceptance concrete
   rather than aspirational (Codex Round 5 #12): the bearing deformation required to mobilize the
   uniform field, `delta_redist = k*t_fs/(E_m*d_b)`, is **computed and printed beside the `f_g` check
   with an explicit engineer-acceptance flag**. No pass/fail threshold is invented because TMS
   provides none; the sheet states that the uniform field is an **assumed ultimate lower-bound
   mechanism requiring engineer acceptance**, and prints the number being accepted.

   **Default `L_u` = the physical bound `t_w/2`** (rev 9). This is not optimism: Decision 14 already
   applies **only in composite mode**, and composite mode already requires the welded connector detail
   of Decision 14, which is specified together with a filled annulus. So where the `k`/`L_c` machinery
   runs at all, near-full contact is a condition of that same detail (rev 11 — rev 9 justified this by
   a "mandatory epoxy fill" that rev 11 demoted to conditional; the justification survives because it
   now travels with composite mode rather than with the base design).

   **The unfilled-annulus case is retained as a printed comparison**, `L_u` = one face-shell thickness
   each end. It is instructive: at `s = 16"` it gives `k = 1.770 k/in` and **every rod diameter
   through 1-1/4" fails grout bearing** (DCR 1.55 to 2.59) — the calc showing in its own numbers that
   a poorly filled annulus and composite action are incompatible.

   **In non-composite mode none of this runs:** `V_x = 0`, so `k = 0` and the only grout demand is
   gravity bearing.

   **Face-shell thickness is a required input, not a hard-coded 1.25"** (Codex Round 4 #11) — it
   varies by unit type, thickness and manufacturer. Defaults from the ASTM C90 minimums per nominal
   wall thickness, editable, source named on the sheet.
   Rev 4's "full grip unsupported" default is retained only as a **reported bound**, because as a
   *design basis* it is incoherent — it credits zero grout while the mechanism requires grout. The
   honest statement, printed on the sheet: **grout participation is required; the design question is
   how much contact length to credit.** A filled annulus is a mandatory detail, and the `L_u`
   sensitivity sweep is reported alongside the governing value.

2. **Grout bearing is a fully specified check**, not a named one (Codex Round 3 #4):
   - contact area `A_br = d_b * L_c`, peak pressure `f_g = k / d_b` (uniform, so peak = average
     within each contact half)
   - checked against TMS 9.1.8, `phi = 0.60` per 9.1.4.2: `f_g <= 0.60 * 0.8 * f'm`
   - **contact reverses with wind sign**, so both signs are run and the envelope reported.

3. **GRAVITY-PLANE rod bending — a second, orthogonal moment that rev 5 omitted entirely**
   (rev 6, Codex Round 4 #1, and it is the finding that changes the answer). Under gravity the rod is
   loaded by distributed grout bearing over `t` and reacted at the two channel webs at `±L_g/2`, so it
   bends in the **vertical** plane:
   ```
   P_rod = w_total * s / rows          gravity load delivered to one rod
   M_grav = (P_rod/2) * ( L_g/2 − t/4 )
   ```
   This is perpendicular to the wind-plane moment `M_wind`, so the rod carries **biaxial bending**.

4. **Rod combined-action check — one procedure, all actions, both planes** (Codex Round 3 #5/#6 and
   Round 4 #2/#3). Rev 4 double-counted `0.577`; rev 5 fixed that but used `V_x` alone and one bending
   plane. Single elastic check on the rod extreme fibre:
   ```
   M_res  = sqrt( M_wind^2 + M_grav^2 )            biaxial bending resultant
   V_res  = sqrt( V_x^2 + V_y^2 )                  V_y = P_rod/2 per plane
   sigma  = N_rod/A_b + M_res/S_rod                S_rod = pi*d_b^3/32
   tau    = 4*V_res/(3*A_b)                        exact max shear, solid circular section
   sqrt( sigma^2 + 3*tau^2 )  <=  phi*F_y ,  phi = 0.90
   ```
   Pure-shear limit implied is `V = 0.39*F_y*A_b`, more conservative than `phi*0.6*F_y*A_b`; stated on
   the sheet so the two are not read as contradictory. **`F_y = 36 ksi` for A307 is a customary value,
   not a specified one** — ASTM A307 specifies `F_u = 60 ksi` minimum and no yield (rev 9). The sheet
   says so, and the input is editable; A449 and A193-B7 have specified yields and are used directly. **AISC J3.7** is retained as the separate bolt
   tension/shear check; the sheet names which controlled.

   **WORKED ANCHOR — and the reason this calc is worth building.** Every input listed so the
   regression fixture is reproducible (rev 7, Codex Round 5 #8/#9 — rev 6 omitted `N_rod`):
   8" wall (`t = 7.625`, `t_w = 0.45`, `L_g = 8.075`), MC18x42.7, `L = 28 ft`, `s = 16"`, `rows = 2`,
   gage `g = 12"`, `e = 1.194"`, `p = 30 psf`, `h_trib = 5 ft`, `w_total = 1.344 klf`,
   `w_ch = 0.672 klf`, physical contact bound `L_u = t_w/2 = 0.225"`, `L_c = 7.625"`, `s* = 1.800"`.

   | quantity | value |
   |---|---|
   | `V_x` (wind shear flow, per rod per plane) | 1.704 k |
   | `V_y` (gravity, per plane) | 0.448 k |
   | `V_res` | 1.762 k |
   | `T_w` (wind tension branch) | 0.100 k |
   | `dF` (torsion couple, top row) | 0.089 k |
   | **`N_rod`** (top row) | **0.189 k** |
   | `M_wind` | 1.917 k-in |
   | `M_grav` | 0.955 k-in |
   | **`M_res`** | **2.142 k-in** |

   **OPTIONAL COMPOSITE CASE ONLY** (rev 12, Codex Round 7 #12 — this table describes the welded
   composite mode, which is informational and cannot pass a design; it says nothing about the
   shipping non-composite basis, where the same rod is adequate. See the non-composite baseline
   immediately below.) Rod steel check, and **the grout-bearing check of item 2 run alongside it** —
   rev 9, after the final Fable pass found that rev 8 quoted the rod result as the headline without
   ever running its own `f_g` check on the same anchor. `k = 0.946 k/in`, `f_g = k/d_b`, allowable
   `0.60*0.8*f'm = 0.912 ksi`:

   | Rod | rod von Mises | vs `0.9*F_y` | rod | **grout `f_g`** | **grout DCR** | governs |
   |---|---|---|---|---|---|---|
   | **3/4" A307 — the reference rod** | **52.93** | 32.4 | **FAIL 1.63** | 1.262 | **FAIL 1.38** | both |
   | 1" A307 | 22.65 | 32.4 | ok 0.70 | 0.946 | **FAIL 1.04** | **grout** |
   | 1-1/4" A307 | 11.79 | 32.4 | ok 0.36 | 0.757 | ok 0.83 | grout |
   | 3/4" A449 | 52.93 | 82.8 | ok 0.64 | 1.262 | **FAIL 1.38** | **grout** |

   **GROUT BEARING GOVERNS BEFORE ROD FLEXURE. ROD *GRADE* IS NO HELP AT ALL; ROD *DIAMETER* AND
   SPACING BOTH ARE.** (rev 10 sharpens rev 9, which overstated this as "spacing, not rod grade";
   Codex Round 6 #12.) `k` is independent of `d_b`, but `f_g = k/d_b`, so **diameter reduces grout
   pressure linearly** — the table above shows 1-1/4" passing grout at `s = 16"`. What does nothing is
   **grade**: A449 raises the rod-steel limit and leaves `f_g` untouched, which is why 3/4" A449 still
   fails grout at 1.38. Spacing is the most efficient demonstrated remedy because halving `s` halves
   `V_x` and therefore `k`, relieving rod steel and grout bearing together:

   | `s` | `V_x` | `k` | 3/4" A307 grout DCR | 3/4" A307 rod DCR |
   |---|---|---|---|---|
   | 16" | 1.703 k | 0.946 | **1.38 FAIL** | **1.63 FAIL** |
   | **8"** | 0.852 k | 0.473 | **0.69 ok** | **0.82 ok** |

   So the reference calc's 3/4" A307 rod is workable — **at 8" o.c., not the 16" it specified**. The
   auto-designer steers on **spacing, rod diameter and `f'm`**; **rod grade is a rod-steel variable
   only**. An implementer who does not internalise that grout bearing, not rod steel, sets the feasible
   region will read the first default run as a bug when it is the physics.

   Axial is negligible here (0.4% of the rod total) but is tabulated so the fixture is complete and
   reproducible by hand.

   **NON-COMPOSITE BASELINE — the rev-11 default basis, same geometry.** With `V_x = 0` the connector
   demand collapses to gravity, and the reference calc's own detail closes:

   | check | value | DCR |
   |---|---|---|
   | wind deflection, `0.42W` vs `L/240` | 1.050 in vs 1.400 in | **0.75** |
   | wind strength, `M_w/2` per channel vs F6 `phi*M_n,y` | 88.2 vs 240.5 k-in | 0.37 |
   | H1-1b combined with gravity (0.359) | — | 0.73 |
   | **rod bending, gravity only** | `M_grav = 0.955 k-in`, vM 23.2 ksi | **0.72** |
   | grout bearing, gravity only | 0.157 vs 0.912 ksi | 0.17 |

   **So the reference calc's 3/4" A307 at 16" o.c. IS adequate — on the non-composite basis at the
   IBC wind serviceability minimum.** But **rod bending at DCR 0.72 is the tightest connector item and
   the reference never checked it**, so the margin it believed it had was not the margin it had. That,
   not the composite scheme, is the durable finding for everyday jobs.

   **Rod flexure governs the connector design, and the reference Tedds calc's 3/4" A307 thru-rod does
   not work** — that calc checked bolt shear, bolt bearing and masonry bearing, but never rod bending
   over an 8-inch grip. The calc must therefore offer **high-strength rod grades (A449, A193-B7) and
   diameters up to 1-1/4"**, and the auto-designer must treat rod diameter and grade as search
   variables alongside shape, `s` and `g`.
5. **Slip is resolved by splitting the basis, not by AISC E6** (Codex Round 2 #5 is right that E6
   gives no load-slip relation — E6.1/E6.2 are retained only for their actual scope, the built-up
   *compression member*). **User decision, locked:**
   - **Strength checks use `I_comp`.** Slip is a displacement, not a strength loss; bearing engages
     and the couple develops at ultimate.
   - **USER DECISION (rev 11, supersedes rev 8): composite action is OPTIONAL UPSIDE, not the design
     basis.** Codex Round 6 #1-#3 established that the rev-8 detail fixes the wrong interface: epoxy
     in the **masonry annulus** does nothing about clearance at the **channel-web hole**, which is
     where longitudinal shear actually enters the rod. At the mandated 1/32" web clearance the worked
     case gives `w_slip = 0.151 klf` against `w_w = 0.150 klf` — **no engagement at all**. Only a
     genuinely positive connection (rod or shear plate **welded** to the channel web, `c_h ~ 0.001"`)
     makes composite action real.

     So the base design is **non-composite**, and composite is unlocked only by selecting the welded
     detail and passing the staged engagement check. `w_slip` is computed and printed every run either
     way, so the engineer can see what composite action would be worth and exactly what detail would
     buy it. **The base design has no contractor-compliance dependency**, which was the decisive
     argument for this choice.

   - **In non-composite mode there is no longitudinal shear flow, so `V_x = 0`** and the whole
     `k` / `s*` / grout-couple machinery is inert. Rod bending is **gravity-only**, and the connector
     collapses to: `M_grav`, `V_y`, `N_rod` from `T_w + dF`, gravity grout bearing, and the AISC hole
     checks. The composite machinery is retained in full but runs only in composite mode.
   - **Pre-slip demand is carried by a STAGED-SLIP analysis, not waved away** (rev 6, Codex Round 4
     #5 — and Codex is right that residual-stress behaviour is not equivalent to a staged change of
     structural system). The rod holes have clearance `c_h`; until the end connectors take it up, the
     pair acts non-compositely, and that moment is locked in.

     **KINEMATICS CORRECTED IN REV 7 (Codex Round 5 #1/#2).** Rev 6 computed end slip as
     `theta_end*(2*z_ch)` — which assumes the composite plane-section behaviour whose *onset* it is
     trying to predict. Circular, and it overstated the lever arm by **7.2x**. Before engagement the
     two channels bend **independently about their own centroidal axes**, so the relative longitudinal
     displacement at the rod is set by each channel's own centroid-to-web-bolt-line offset:
     ```
     zeta_A = t_w/2 - xbar     zeta_B = xbar - t_w/2     relative lever = 2*(xbar - t_w/2)
     MC18x42.7:  2*(0.877 - 0.225) = 1.304 in    (rev 6 wrongly used 2*z_ch = 9.379 in)
     ```
     Staged procedure:
     ```
     end slip at load w  =  theta_end * 2*(xbar - t_w/2) ,  theta_end = w*L^3/(24*E*2*Iy)
     transition load     w_slip  solves  theta_end*2*(xbar - t_w/2) = c_h
     Stage 1 (w <= w_slip):  non-composite. locked-in M_y,ch = w_slip*L^2/16
     Stage 2 (w  > w_slip):  composite on the increment  dw = w_w - w_slip
     TOTAL channel demand:  M_y,ch = M_y,locked + (dw-based composite M_y,ch)
                            N_ch   = dw-based composite axial only
     ```
     If `w_w <= w_slip` the case is fully non-composite.

     **AND WITH STANDARD HOLES IT ALWAYS IS.** Corrected kinematics, MC18x42.7 at `L = 28 ft`:

     | hole condition | `c_h` | `w_slip` |
     |---|---|---|
     | standard 1/16" oversize | 0.0625" | **0.302 klf** |
     | both holes adverse | 0.125" | 0.604 klf |
     | reamed 1/32" | 0.03125" | 0.151 klf |
     | epoxy-filled / fitted | 0.005" | 0.024 klf |

     Design wind at 30 psf over a 5 ft tributary is **0.150 klf**; at 60 psf, 0.300 klf. So with
     standard oversize holes **composite action is never dependable at design wind** — it is not
     reached at 30 psf, and at 60 psf it is marginal by under 1% (0.300 vs 0.302 klf), which is not a
     margin any design should rest on. That applies to strength as much as deflection. Composite action is available **only with a
     fitted or epoxy-filled connector detail.** The calc must compute `w_slip`, compare it to the
     design wind, and **state on the sheet whether composite action engages**; where it does not, the
     design is non-composite and is reported as such regardless of what the user selected. **The non-composite strength case is also
     computed and reported every run**, and the sheet states plainly whether the design relies on
     composite action for strength at all — where it does not, the slip question is moot.
   - **The non-composite case runs the FULL check set, not just F6** (Codex Round 4 #6): strong-axis
     gravity moment, weak-axis wind moment, shear, torsion and the H1 biaxial interaction, exactly as
     the composite case does.
   - **The non-composite wind split GOVERNS, it is not merely swept** (rev 12, Codex Round 7 #16 —
     a 50/50 result cannot be called the design case if 60/40 or 100/0 gives a larger DCR). The
     engineer selects the design sharing ratio and **that selection governs the unity checks**; the
     **auto-designer envelopes the prescribed adverse split** rather than reporting it as a
     diagnostic. The 50/50, 60/40 and 100/0 sweep remains, as evidence rather than as design basis.
   - **The wind deflection check is `L/240` at `0.42W` on non-composite `2*Iy`** (rev 11 basis,
     IBC Table 1604.3 note (f)), computed by the staged procedure of Phase 8 so that pure `I_comp` is
     never substituted while `w_slip > 0`. Composite and pure-non-composite bounds are printed
     alongside so the value of the optional welded detail is visible as a number.
   - **The base design carries no contractor-compliance dependency.** That is the point of the rev-11
     basis: the delivered capacity does not depend on a field detail being executed correctly. Only
     if the engineer opts into composite mode does the welded connector become a verification item.
6. **`I_comp` and `2*Iy` are both printed on every run**, with the deflection ratio, so the cost of the
   split basis is visible.
7. **Hard fail, not a warning:** if the connectors at the selected layout cannot develop the required
   shear flow `q`, the calc reports FAIL for composite action and the non-composite result becomes the
   only valid answer for strength as well.

---

## Torsion — full free body (rewritten after Round 1)

Round 1 was right that rev 1 was ambiguous by a factor of two and never proved the two channels'
torques do not cancel. The derivation, with `w_ch` = **per-channel** line load (`w_total/2`):

Axes: `x` = span, `y` = up, `z` = out of face 1. Channel A on face 1 (flanges toward `+z`),
channel B on face 2 (flanges toward `-z`).

- **`e_o` datum, verified numerically, not assumed.** The channel shear-center offset from the **web
  centerline**, `e_cl = 3*t_f*b'^2 / (6*b'*t_f + h*t_w)` with `b' = b_f - t_w/2` and `h = d - t_f`,
  minus `t_w/2` to shift the datum to the **back of the web**, reproduces the AISC v16.0 database
  `e_o` for **all 72 C and MC shapes within 0.64% worst case** (MC13x40: 1.0366 predicted vs 1.03
  tabulated). MC18x42.7: `e_cl = 3(0.625)(3.725^2) / (6(3.725)(0.625) + 17.375(0.45)) = 1.194 in`
  from the web centerline, `- t_w/2 = 0.969` from the back of the web, matching the tabulated `e_o`
  **exactly**. (The cruder `b^2*h^2*t_f/(4*Ix)` form agrees only to 2.7% and is not used.)
  So `e_o` is measured from the back of the web, on the side away from the flanges, and the
  bolt-line-to-shear-center distance is `e = e_o + t_w/2`. **MC18x42.7: e = 0.969 + 0.225 = 1.194 in.**
- Channel A: load `-y` applied at `z_load = t/2 + t_w/2`, shear center at `z_SC = t/2 - e_o`.
  `M_x,A = -(z_load - z_SC)*F_y = +w_ch*e` per unit length.
- Channel B, mirrored: `M_x,B = -w_ch*e`. **The two torques are opposite about the global x-axis.**
- Resisting couple on A from rod forces at `y = +/- g/2`: `M_x = (g/2)*(F_top - F_bot)`.
  Setting `= -w_ch*s*e` gives `F_top = -w_ch*s*e/g` (rod pulls A **toward** the wall) and
  `F_bot = +w_ch*s*e/g` (masonry face bears **outward** on A).
- Same treatment on B gives `F_top,B = +w_ch*s*e/g`, which for channel B is also **toward** the wall.

**Result: the top-row rods are in tension; the bottom row is in bearing. Both channels pull the same
(top) rod, from opposite ends — so the torques reinforce rather than cancel, and the rod tension is**

```
dF = w_ch * s * e / g          (top row only; w_ch is PER CHANNEL)
```

**not** `2*w_ch*s*e/g` — the two end pulls are the two ends of one rod's tension, not additive.
This is why two rows is the right layout: a single row leaves the channel in St. Venant torsion.
Local torsion between bolt columns is still checked (AISC H3.3 over span `s`), expected trivial.

---

## Code references — verified against `RE CODING/Masonry/tms_full.txt` (TMS 402-22)

| Provision | Content | Status in this calc |
|---|---|---|
| TMS 4.2.2 (Table) | `Em = 900 f'm`, `G = 0.4 Em` | reference only (masonry stiffness not used) |
| TMS 4.4.4 | `Abr <= A1*sqrt(A2/A1)`, `<= 2*A1` | A2 enhancement **not** taken (conservative) |
| TMS 4.6 | `l/600`, beams supporting unreinforced masonry, service D+L | governs gravity |
| TMS 5.1.1.1 | Concentrated load dispersion 2V:1H, **3V:1H adjacent to an opening** | point-load input |
| TMS 9.1.4.1 | phi: 0.75 anchor steel tension, 0.65 anchor steel shear, 0.65 pullout, **0.50** breakout/crushing/pryout | |
| TMS 9.1.4.2 | **phi = 0.60** bearing on masonry | reference's "3.1.4.2" is TMS 402-11 numbering |
| TMS 9.1.6.3.1 Eq. 9-1 | Tension breakout `Banb = 4*Apt*sqrt(f'm)` | **NOT CREDITED** — `Apt` not constructible for a thru-rod (see note) |
| TMS 9.1.6.3.1 Eq. 9-2 | Steel tension `Bans = Ab*fu`, `fu <= min(1.9fy, 125 ksi)` | **COMPUTED** — one of the two `B_an` mechanisms |
| TMS 9.1.6.3.2 Eq. 9-4 | Shear breakout `Bvnb = 4*Apv*sqrt(f'm)` | **COMPUTED in BOTH gravity directions** with separate up/down `l_be`, plus at the jamb with group overlap |
| TMS 9.1.6.3.2 Eq. 9-5 | Crushing `Bvnc = 1750*(f'm*Ab)^0.25` | **COMPUTED — no thickness term** |
| TMS 9.1.6.3.2 Eq. 9-6 | Pryout `Bvnpry = 2.0*Banb = 8*Apt*sqrt(f'm)` | **NOT CREDITED** — depends on the same non-constructible `Apt` |
| TMS 9.1.6.3.2 Eq. 9-7 | Steel shear `Bvns = 0.6*Ab*fu` | computed; compared against AISC J3.6, lower governs |
| TMS 9.1.6.3.3 Eq. 9-8 | `(bau/phi*Ban)^(5/3) + (bvu/phi*Bvn)^(5/3) <= 1` | computed with the **single `B_an` design-strength definition** below (rod steel and face-shell bearing, `phi` per mode applied **before** the minimum) |
| TMS 9.1.8 | Bearing `0.8*f'm*Abr` | computed |
| TMS 9.3.4.4.**3** | **Moment magnifier** for the pier | **corrected** — 9.3.4.4.2 is the P-delta/slender-wall method (tms_full.txt:8578-8626) |
| TMS 9.3.3.5 / 9.3.4.2.2 | Max / min reinforcement | flagged |
| AISC 360-22 B4.1b | Flange and web classification | |
| AISC 360-22 D2 | **Tension member: gross yielding + net section rupture** (tension channel has holes) | added Round 1 |
| AISC 360-22 E3 / E4 | Compression: flexural and **flexural-torsional (singly symmetric channel)** | added Round 1 |
| AISC 360-22 E6.1 / E6.2 | Built-up member modified slenderness + connector spacing limits | **Built-up compression-member provisions ONLY. NOT used to establish slip or composite stiffness** — E6 provides no load-slip relation. Slip is handled by Decision 14. |
| AISC 360-22 F2 / F2-8b | Channel major-axis flexure, singly-symmetric `c` factor | |
| AISC 360-22 F6 | Minor-axis flexure, use the **smaller** `Sy` | |
| AISC 360-22 G2 | Shear | |
| AISC 360-22 H1.1 / H1.2 / H3.3 | Combined axial + biaxial flexure; torsion | |
| AISC 360-22 App. 8 | **B1 amplification** of `M_y` for the compression channel | added Round 1 |
| AISC 360-22 App. 6 | **Brace strength AND stiffness** at each rod column, for both LTB (`L_b = s`) and compression (`L = s`) | added rev 4 — spacing alone does not establish bracing |
| AISC 360-22 J3.3 / J3.4 / J3.6 / J3.10 / J4.3 | Spacing, edge distance, shear, bearing-tearout, **block shear** | |
| AISC 360-22 J3.7 | **Combined tension and shear on the rod steel** (`F'_nt` reduction) | added rev 3 — distinct from TMS Eq. 9-8, which is the masonry side |

**Applicability caveat, stated on the output sheet.** TMS 9.1.6.3 is written for *headed and bent-bar
anchor bolts embedded in grout*. A thru-rod with plate washers and nuts on both faces is not literally
either, though the washer/nut assembly is mechanically a double-ended head. These equations are
therefore applied **by analogy — informational, and NOT demonstrably conservative** (rev 5; rev 3/4
wrongly called the analogy conservative in this paragraph while correctly calling it informational
elsewhere). The **independently justified rod, washer, face-shell, grout-bearing and bond-beam checks
govern** wherever they give a lower capacity. Where a job needs more, ASTM C1892 test data is the path.

**Eq. 9-1 (tension breakout) and Eq. 9-6 (pryout) are NOT CREDITED — for a geometric reason, not a
mechanism argument** (rev 4, after Codex Round 2 #17/#18). Rev 3 proposed computing them with the
far-face washer as the head and embedment `= t`. That is worse than dismissing them: a cone projected
from the full wall thickness is **fictitious** — it crosses hollow cells, unit webs, bed joints,
isolated grout boundaries, adjacent rods, and wall edges, and would *overpredict* the real face-shell
or grout failure. `Apt` is simply not constructible for this geometry without the actual grouted-cell
layout. So they are neither credited nor waved away: the sheet states that `Apt` cannot be
constructed, and **tension capacity is governed by mechanisms that can be computed from real
geometry**:

```
B_an = min( rod steel tension : TMS Eq. 9-2 (Bans = Ab*fu, fu <= min(1.9fy, 125 ksi)) and AISC J3,
            face-shell bearing under the plate washer, from the actual washer footprint and
              face-shell thickness )
```

with **phi applied per failure mode before taking the minimum**, not after. The same single definition
of `B_an` is used in the code table, in Phase 5, and in the Eq. 9-8 interaction — rev 3 had the table
and the text disagreeing (Codex Round 2 #19).

`B_vn` for the **steel** planes is `min(AISC J3.6, TMS Eq. 9-7)` per plane. The **masonry** capacities
(9.1.8 bearing, Eq. 9-4 breakout, Eq. 9-5 crushing) are **not** "per shear plane" quantities — they
depend on the total rod-on-masonry force field and geometry, so they are evaluated against the rod's
resultant masonry demand from the complete free body, on their own line (Codex Round 2 #20).

**The TMS analogy is labeled informational, not conservative.** Rev 3 called the thru-rod-as-headed-
anchor mapping "conservative." That claim is unsupported; it is an **analogy**, and where it produces
capacities that exceed independently justified washer / face-shell / grout capacity, the independently
justified value governs. ASTM C1892 testing remains the escalation path.

**TMS 4.6 is adopted, not mandated, here.** Its stated scope is beams supporting *unreinforced*
masonry (designed per 8.2 / 9.2 / 11.2 / Ch. 15). An existing wall may be reinforced, in which case
`l/600` is an adopted serviceability target rather than a code requirement. Labeled as such.

TMS 402-22 contains **no arching provision for lintels** — "arching" appears only for infill
out-of-plane (Chapter 12). Any triangular reduction is judgment, so it is opt-in and banner-warned.

---

## Errors found in the reference Tedds calc, deliberately corrected

1. **Bolt shear `phi*r_n = 12.5 kip` for a 3/4" A307 is not reproducible.** AISC 360 Table J3.2 gives
   A307 `F_nv = 27 ksi`; `phi*r_n = 0.75*27*0.4418 = 8.95 kip` per shear plane. Compute J3.6 directly.
2. **Web thickness taken as 0.40 in for MC18x42.7.** AISC v16.0 gives `t_w = 0.45 in`. Read from catalog.
3. **Bolt bearing taken as `73.1 kip/in` from Table 7-5**, which embeds an assumed edge distance and
   spacing. Compute AISC J3.10 explicitly from the actual `l_c`.
4. **TMS 9.1.8 alone over-credits thick walls.** `0.8*f'm*d_b*t` scales with `t`; Eq. 9-5 has no
   thickness term. At 8" they agree within 10% (5.22 k vs 4.71 k); at 12" bearing gives 8.18 k against
   4.71 k — a 74% over-credit. Minimum-of-all-limit-states resolves it.
5. **Wrong TMS edition numbering.** Reference cites "3.1.7" and "3.1.4.2" (TMS 402-11); current is
   9.1.8 and 9.1.4.2.
6. **Rod bending over the grip was never checked, and the specified rod fails because of it.** The
   reference sized 3/4" A307 thru-bolts from shear, hole bearing and masonry bearing. Adding the
   biaxial rod-flexure check gives, **in the optional composite mode only**, a von Mises stress of
   **52.93 ksi against 32.4 ksi (DCR 1.63)** with grout bearing at **DCR 1.38** — the connector fails
   twice over *if composite action is pursued at 16" o.c.* **This is not a statement that the
   reference rod is inadequate** (rev 12, Codex Round 7 #12): on the shipping non-composite basis the
   same 3/4" A307 at 16" o.c. is adequate, at rod-bending DCR 0.72. What survives as the general
   finding is narrower and more useful: **the reference calc never checked rod bending at all**, and
   on its own basis that check comes out at 0.72 — the tightest connector item, and not the margin it
   believed it had.
7. **Load reconciliation.** Tedds' `M_u = 72.7 kip-ft` back-solves to `w = 0.742 klf` while
   **`1.2*(1120/2 + 42.7) = 0.723 klf`** (rev 9: rev 8 wrote `1120/2 + 1.2*42.7`, which evaluates to
   0.611 — and this is the load-assembly convention Fixture A asserts against, so the expression has
   to be right). The 2.5% gap must be explained in Fixture A, not absorbed.

---

## Approach

### Build order and architecture (rev 3)

**Phases are numbered in dependency order — the number IS the build order** (rev 4, Codex Round 2 #28:
rev 3 had a diagram that contradicted its own numbering, which is a poor implementation contract).
The one non-obvious dependency, made explicit: the composite core (§Composite wind path) produces
`P_r` and `M_ry`, which the H1 interaction consumes, so the composite core is numbered **before** the
interaction step. Read the numbers left to right and build in that order:

```
S0 reconciliation -> S1 catalog -> S2 geometry/loads/skeleton
   -> S3 composite core  ** INCLUDING the staged-slip engine: w_slip, engagement verification,
                            Stage-1 locked-in M_y, Stage-2 increments **
   -> S4 section strength -> S5 interaction -> S6 connectors -> S7 wall panel
   -> S8 jamb + pier -> S9 deflection -> S10 installation block -> S11 UI/auto-design
   -> S12 registration + verification

Rev 9 assigns the staged-slip engine explicitly to **S3**: its equations were complete in
§The connector mechanism but no build step owned them, and its outputs feed S4/S5 demands and S9
deflection, so it cannot be left to fall out of the narrative.
```

The `### Phase N` headings below retain their historical numbers so the review log stays traceable;
the `S`-numbers above are the contract.

**Architecture requirement:** write the entire check engine as **pure JS compute functions that take a
plain input object and return a plain result object, with no DOM access**. The UI layer reads inputs,
calls the engine, and renders. This is what makes Fixtures A and C runnable headless in CI instead of
by clicking through a page. **Follow the existing precedent exactly: a separate engine file at
`public/Calcs/js/masonry_opening_channel_lintel_engine.js` pulled in with `<script src>`**, which is
what `public/Calcs/js/deep_beam_stm_engine.js` actually is — rev 8 described it as an inline block,
which it is not.

### Phase 0 — Reference reconciliation (must complete FIRST)
0. Resolve the Tedds `w = 0.742 klf` back-solve against the `1.2*(1120/2 + 42.7) = 0.723 klf` assembly
   **before writing any load code** — it defines the load-assembly convention that Fixture A asserts
   against. A 2% tolerance against a source with an unexplained 2.5% internal discrepancy is
   unsatisfiable. If it cannot be explained, restate Fixture A to assert against Tedds' back-solved
   `w` exactly, plus a **separate** assertion on this calc's own assembly from first principles.
   **This is a hard build gate** (rev 10, Codex Round 6 #15): Fixture A may not be called "reference
   reproduction at 2%" while its reference load is internally inconsistent. Either the reconciliation
   completes, or the fixture is formally split, before reference reproduction is claimed complete.
   **Neither the UI nor the documentation may claim 2% reference reproduction until this gate closes**
   (rev 12, Round 7 #21).

### Phase 1 — Section catalog
1. Generate an inline `DB` from `public/Calcs/aisc-shapes-database-v16.0.xlsx` for all 32 `C` and
   40 `MC` shapes: `A, d, bf, tf, tw, xbar, eo, Ix, Sx, Zx, rx, Iy, Sy, Zy, ry, J, Cw, ro, H`.
   Existing channel calcs carry C6-C15 only and lack `xbar`/`eo`, so a new table is required.
   **Generate it programmatically from the xlsx** — the sheet has duplicated imperial/metric column
   headers (`eo`, `x`, `Ix` each appear twice, 166 columns) and hand transcription will fumble it.
   Keep the MC18x42.7 anchor assertion as an engine **startup self-test**.
2. Sanity-anchor MC18x42.7: `A = 12.6`, `d = 18.0`, `t_w = 0.45`, `xbar = 0.877`, `eo = 0.969`,
   `Ix = 554`, `Iy = 14.3`, `Sy = 4.64`, `J = 1.23`, `Cw = 852`.

### Phase 2 — Geometry, loads, and load combinations
3. Inputs: clear opening `L`, wall thickness selector, `H_wall` above opening, total wall height,
   `w_cmu`, `f'm` **with a required basis field (test / prism / assumed — warns if assumed)**,
   grouting extent (isolated cells vs continuous bond beam), channel section (or auto), `F_y`,
   rod diameter/grade, gage `g`, spacing `s` (or solve), jamb extension and bolt group, **pier
   unsupported height, tributary width, and top/bottom restraint**, reinforcement, wind pressure `p`
   with classification/zone/effective area/enclosure.
4. Define and use two separately named quantities everywhere: `w_total` and `w_ch = w_total/2`.
   No expression may use an unqualified `w_u`.
5. Enumerate the **signed** ASCE 7-22 LRFD combinations explicitly, with each input load assigned a
   category (D / L / Lr / S / W). Track and report the governing combination per check.
6. Point loads: dispersed per TMS 5.1.1.1 at 3V:1H and **retained as patch loads** — no
   "equivalent UDL" conversion. Moment, shear, and deflection all integrate the actual patch.
7. Warn if `d > H_wall` above the opening, if `s` is off the 8" module, or if grouting is isolated
   cells only (recommend a continuous grouted bond beam course at the rod lines).
7b. **Decide the base CSS and theme opt-in here, at file-skeleton time** — `are-theme-v2.css` uses
   `!important` input sizing, so calcs on the older `are-calc.css` must opt out with
   `<script src="/are-utils-v2.js" data-no-theme>`. This choice touches all markup, so it cannot be
   deferred to the output phase.

### Phase 3a — Channel section strength (build BEFORE 3b, AFTER Phase 4)
8. Classification B4.1b, then strong-axis F2.1 / F2.2 with the Eq. F2-8b channel `c` factor.
   **`L_b = s` must be EARNED, not assumed** (rev 4, Codex Round 2 #13/#14): web attachments do not
   constitute compression-flange and twist bracing merely by existing at spacing `s`. Run
   **AISC App. 6 brace strength and stiffness** at each rod column. **`L_b` defaults to the full span
   `L`** and reduces to `s` only if App. 6 passes. Provided stiffness is the series combination
   (rev 5, Codex Round 3 #10 — rev 4 named the components without defining them):
   ```
   1/beta_prov = 1/k_rod + 1/k_washer + 1/k_wall
     k_rod    = A_b*E_s / L_g                    rod axial stiffness over the grip
     k_washer = E_s * A_wsh / t_wsh              plate washer taken as an axially loaded pad;
                                                 effectively rigid vs k_wall, retained for closure
     k_wall   = Em * A_wsh / t_fs                face-shell compression under the washer footprint,
                                                 Em = 900*f'm (TMS Tbl 4.2.2), A_wsh = washer
                                                 bearing footprint, t_fs = face-shell thickness
   ```
   These are **explicit but idealized** (rev 6, Codex Round 4 #8): `k_wall` treats the face shell as a
   uniformly compressed pad under the washer, which ignores plate flexibility and local crushing.
   The sheet states the idealization. **The default is full span; the engineer must affirmatively
   accept this stiffness basis to take credit**, and any stiffness that cannot be established leaves
   the full span in force.
   - **Beam bracing (LTB): use the POINT (nodal) provisions, App. 6.3.1b — NOT the relative/panel
     provisions of 6.3.1a** (rev 9). Discrete rods anchored to the wall are point braces, and point
     bracing carries the larger stiffness demand, so the distinction is unconservative in the wrong
     direction if got wrong. **The equation numbers and coefficients in rev 8 (`0.01*M_r*C_d/h_o`
     cited to A-6-7) match no AISC edition and must NOT be transcribed from this plan** — the
     implementer reads AISC 360-22 Appendix 6 directly and cites what is actually there. Flagged as an
     open implementation item, not a settled equation. **Until those provisions are read from the
     spec and tested, `L_b = s` and any reduced `KL` are DISABLED IN CODE, not merely flagged** — the
     full-span default ships first and the reduction is unlocked only after verification (rev 10,
     Codex Round 6 #14). **No engineer-facing override may be exposed that bypasses this** — the
     reduction is absent from the UI in release 1, not merely defaulted off (rev 12, Round 7 #20). Torsional restraint from the two-row couple
     `beta_T = beta_prov*g^2/2` vs App. **6.3.2a** `beta_Tb`, including web distortional stiffness
     `beta_sec` per A-6-12.
   - **Column bracing (E3/E4 effective length) is a SEPARATE check under App. 6.2**, not inferred from
     the beam-bracing result (rev 6, Codex Round 4 #9 — rev 5 conflated the two). Nodal or relative
     column brace strength and stiffness per A-6-3 / A-6-4 as applicable.
   - **If any required stiffness cannot be calculated, the full span is used** for that mode. No
     credit by default, per mode, for both beam and column bracing.
9. Shear AISC G2 on **gross** `A_w = d*t_w` (no hole deduction mid-span — stated explicitly; the
   jamb group's net-section paths are covered by J4.3 in Phase 7).
10. Minor-axis F6 using the **smaller** `S_y`.
11. **Compression (wind couple): `P_c = phi*P_n` per AISC E3 and E4 flexural-torsional buckling**
    (the channel is singly symmetric, so E4 must be run), plus **E6.1 modified slenderness** and
    **E6.2 connector spacing limits** for the built-up pair. **Effective length is determined per mode,
    not globally** (rev 4, Codex Round 2 #12): the rods restrain out-of-plane translation and, via the
    two-row couple, twist — but only where App. 6 brace strength and stiffness are satisfied. Any
    axis or mode without verified connector restraint uses the **full span**. State the governing
    `KL` for each of E3 flexural and E4 flexural-torsional separately.
12. **Tension (wind couple): AISC D2** gross yielding and net-section rupture through the rod holes,
    with shear lag `U` per Table D3.1 for a member connected through the web only.

### Phase 3b — Interaction (requires Phase 4 outputs)

**12a. DEFAULT BRANCH (non-composite) — the shipping interaction, and it comes first.**
No composite axial couple exists, so `P_r = 0` and the E3/E4 compression checks and D2 tension checks
of Phase 3a **do not apply in this branch** (rev 12, Codex Round 7 #4 — those limit states arise from
the composite couple and were sitting unconditionally). What the channel actually carries:
- strong-axis moment from gravity (F2),
- its **allocated share** of weak-axis wind moment (F6, smaller `S_y`),
- shear (G2), and torsion (H3.3 over `s`).

Combined by **AISC H1-1b with `P_r = 0`**, reducing to `M_rx/M_cx + M_ry/M_cy <= 1.0`. Reference-case
anchor: `0.359 + 0.37 = 0.73`. Both wind signs run. This is the interaction the calculator ships.

**12b. OPTIONAL BRANCH (composite) — behind `compositeMode`, informational only.**
13. Combined: **H1.1** for the compression channel (with **App. 8 B1 amplification** on `M_y`),
    **H1.2** for the tension channel. **Run both wind signs** — the compression and tension channels
    swap between `+p` and `-p`, so both channels must be checked in both roles.
14. **H3.3** local torsion over the bolt-column span `s`.

### Phase 4 — Wind path

**14a. DEFAULT BRANCH (non-composite) — build this first; it is the shipping path.**
`w_w = p*h_trib`; `M_w = w_w*L^2/8`. Allocate `M_w` to the two channels by the governing sharing rule
(Phase 2), each channel then checked in **weak-axis bending per AISC F6** using the smaller `S_y`.
**Outputs `N_ch = q = V_x = M_wind,rod = k = 0` identically** — asserted, not assumed (Fixture C).
No composite quantity is computed, referenced, or displayed as a demand in this branch.

**14b. OPTIONAL BRANCH (composite) — informational only, behind `compositeMode`.**
15. `z_ch = t/2 + xbar`; `I_comp = 2*(Iy_ch + A_ch*z_ch^2)`; `Q = A_ch*z_ch`.
    Anchor: MC18x42.7 in an 8" wall, `z_ch = 4.690 in`, `I_comp = 583 in^4` vs `2*Iy = 28.6 in^4`
    non-composite — a **20.4x** gain. That gain is real arithmetic but it is **not the shipping
    design basis** (rev 12): it is available only behind a welded connector that has not been designed,
    so it is reported as informational upside, never as capacity.
16. `w_w = p*h_trib`; `M_w`, `V_w` from the enumerated combinations.
17. Decompose: axial `N_ch = M_w*A_ch*z_ch/I_comp`, local minor-axis `M_y,ch = M_w*Iy_ch/I_comp`.
18. Shear flow `q = V_w*Q/I_comp`. Anchor: `q = 0.1014*V_w`.
19. **Wording, corrected:** the *ideal symmetric elastic gravity model* produces zero longitudinal
    composite shear flow, because both channels share the same horizontal neutral axis at mid-depth
    so `Q = 0` about that axis and the channels act in parallel. This is not a claim that the rods are
    unloaded under gravity — they carry the entire gravity transfer in the `y` direction.
20. Always print `2*Iy` alongside `I_comp`, and the composite/non-composite deflection ratio.

### Phase 5 — Connector design (the governing engine)
21. Demands **per shear plane**, at a candidate layout (`s`, `g`, 2 rows). **In the default
    non-composite mode every longitudinal term below is identically zero** and the connector reduces
    to the gravity actions plus `T_w` and `dF` (rev 12, Codex Round 7 #5):
    - Vertical (gravity): from an **elastic bolt-group solution**, then **halved** per plane —
      the load enters between the webs and splits. **Both modes.**
    - Longitudinal (wind shear flow): `q*s/rows`, **NOT halved** — channel-to-channel transfer, so
      each plane carries it in full. **`compositeMode` ONLY; zero by default.**
    - Out-of-plane wind: **separate pressure and suction free bodies** (rev 4, Codex Round 2 #16).
      Under pressure, the wall bears directly on the leeward channel and the windward channel engages
      through rod tension; under suction the roles reverse. `T_w = p*h_trib*s/rows` is the rod-tension
      branch only — the bearing branch is a contact demand, not a rod demand, and both are drawn.
    - **Torsion couple `dF = w_ch*s*e/g` tension on the TOP ROW**, and an **equal `dF` out-of-plane
      bearing demand on the BOTTOM ROW** (rev 4, Codex Round 2 #15 — rev 3 carried only the tension
      half). The bottom-row bearing is checked against channel web local bearing, washer/contact
      area, face-shell bearing, and grout bearing.
22. `R_plane = sqrt((V_y,bolt/2)^2 + (q*s/rows)^2)`; tension `T_r = T_w + dF` on the top row,
    `T_r = T_w` on the bottom row, plus the bottom-row bearing demand above.
23. Capacities, in **two separate families** (rev 6 — this item still carried rev-3 wording; Codex
    Round 4 #12):
    - **Steel, per single shear plane:** AISC J3.6, AISC J3.10 from real `l_c`, TMS Eq. 9-7, and
      AISC J3.7 for the tension/shear pair.
    - **Masonry, on the rod's resultant force field** (NOT per shear plane — these depend on total
      rod/masonry geometry): TMS 9.1.8 bearing, Eq. 9-5 crushing, Eq. 9-4 breakout, and the grout
      bearing check of §The connector mechanism item 2.
    - **Tension `B_an`:** rod steel (Eq. 9-2 / AISC J3) and face-shell bearing under the plate washer,
      `phi` per mode before the minimum.
    - **Eq. 9-1 and Eq. 9-6 are NOT credited** (`Apt` not constructible) and appear in the output only
      in the not-credited list with their reason.
    - The **rod combined-action check** of §The connector mechanism item 4 is evaluated alongside
      these. **No mode is presumed to govern** (rev 10, Codex Round 6 #10 — rev 9 still carried the
      rev-8 claim that rod steel governs, which its own grout companion contradicts). Rod steel, grout
      bearing, breakout, crushing and hole bearing all compete; the layout enumeration determines
      which controls for a given configuration, and the sheet names the winner.
24. **Eq. 9-4 breakout is evaluated in BOTH gravity directions for field bolts**, with separate
    user inputs for `l_be` **upward** (to the top of wall / nearest opening above) and `l_be`
    **downward** (bottom bolt row to the cut soffit). Reviewers disagreed on whether the field-bolt
    bearing reaction loads the masonry up (no free edge) or down (toward the fresh cut), so the calc
    **computes both and takes the minimum** rather than relying on the argument. At 4" above the
    soffit this is not academic: `Apv = pi*4^2/2 = 25.1 in^2`, `Bvnb = 4*25.1*sqrt(1900) = 4.38 k`,
    `phi*Bvnb = 2.19 k` — below `phi`-crushing at **4.71 k** (rev 9: rev 8 wrote 2.36 k, a per-plane
    halving that item 23 explicitly forbids for masonry checks; 4.71 k is the value used in Errors #4).
    Breakout still governs, so the conclusion is unchanged.
25. **Rod-on-grout procedure — implement exactly as derived in §The connector mechanism**, not as a
    sensitivity sweep (rev 5; rev 4 left stale rev-3 wording here). In order:
    a. `L_g = t + t_w`; **`L_u` defaults to the physical bound `t_w/2`** (rev 10 — this item still
       carried the pre-rev-9 face-shell default; Codex Round 6 #8). The face-shell case is retained
       only as a printed comparison. `L_c = L_g − 2*L_u`, with `L_c <= t` enforced.
    b. Grout reaction intensity `k = 4*V_x*L_g / L_c^2`; `s* = L_c^2/(4*L_g)`.
    c. **Wind-plane** rod moment `M_wind = V_x*(L_u + s*/2)`; verify against the bounds `V_x*L_g/8`
       (full contact, mathematical) and `V_x*L_g/2` (no grout credit — comparison only, must fail).
    d. **Gravity-plane** rod moment `M_grav = (P_rod/2)*(L_g/2 - L_c/4)`, `P_rod = w_total*s/rows`
       (rev 7 added gravity bending; **rev 9 uses `L_c/4`, not `t/4`** — the gravity and wind models
       must credit the SAME contact length for the same annulus. Identical at the physical bound where
       `L_c = t`; at an unfilled default it raises `M_grav` by about 9%).
    e. Resultants `M_res = sqrt(M_wind^2 + M_grav^2)`, `V_res = sqrt(V_x^2 + V_y^2)`,
       `N_rod = T_w + dF` on the top row.
    f. Grout bearing `A_br = d_b*L_c`, `f_g = k/d_b` vs `0.60*0.8*f'm` (TMS 9.1.8), **both wind signs**
       for contact reversal.
    g. Rod combined check `sigma = N_rod/A_b + M_res/S_rod`, `tau = 4*V_res/(3*A_b)`,
       `sqrt(sigma^2 + 3*tau^2) <= 0.90*F_y`, across grades (A307 / A449 / A193-B7) and diameters
       to 1-1/4".
    h. Report the `L_u` sensitivity sweep **in addition to** the governing result.
26. Interaction: the **rod von Mises check of 25(g)** is the three-action combination (rev 10 — rev 9
    pointed at 25(e), which only defines the resultants; Codex Round 6 #9).
    **TMS Eq. 9-8** (masonry side) and **AISC J3.7** (bolt tension/shear pair) are also computed as
    distinct limit states; the sheet names which controlled.
27. AISC J3.3 spacing, J3.4 edge distance, **J4.3 block shear** on the two-row pattern in the web.
28. **Layout solver:** enumerate permitted (`s`, `g`) combinations on the 8" module within edge and
    spacing limits, **re-run the complete check set on each**, and return the feasible layouts ranked.
    No independent per-mode linear solve, no post-hoc snapping.

### Phase 6 — Wall panel local checks (added Round 1)
28. **Wind-direction inter-bolt span**: the masonry strip above the opening spanning **horizontally
    between bolt columns** under `p`. The model must be **fully specified, not named** (rev 4, Codex
    Round 2 #23): one-way horizontal strip, **enveloped over simple-span, fixed-fixed, and
    interior-continuity support cases** (rev 5, Codex Round 3 #9 — discrete rods through isolated
    cells do not automatically supply rotational fixity, so a fixed-fixed-only model is
    unconservative at midspan). Effective section = **grouted-cell net section** where the strip
    crosses grouted cells and **face-shell bedded section** elsewhere, checked for flexure and shear
    against **TMS 9.2** (unreinforced) or **9.3** (reinforced) per the wall's actual reinforcement,
    with support reactions delivered into the grouted cells that contain the rods.
29. **Face-shell BEARING** under the plate washer and the channel web bearing footprint, for the
    wind tension branch, the wind bearing branch, and the bottom-row torsion bearing. Checked as
    `T_r / A_wsh <= 0.60*0.8*f'm` per TMS 9.1.8 / 9.1.4.2. **"Punching" is dropped** (rev 9): TMS has
    no masonry punching-shear provision, and rev 8 named the check without a perimeter model or an
    allowable stress. Bearing on the actual washer footprint is the defensible check.
30. **Gravity inter-bolt span is handled by a mandatory applicability condition, not an argument**
    (rev 4, Codex Round 2 #22 — "deep element, arches trivially" is a conclusion, not a check).
    **A continuous reinforced grouted bond beam spanning the opening is a required condition of use**,
    with **constructible geometry specified, not a slogan** (rev 5, Codex Round 3 #11 — two rod rows
    may fall in different courses, so "a course at the rod lines" is not buildable as written):
    - **Grouted courses:** every course containing a rod row, plus the courses between them, grouted
      solid and continuous from jamb to jamb — so with two rows at gage `g`, that is
      `ceil((g + d_b)/8) + 1` courses, reported explicitly for the chosen layout.
    - **Horizontal reinforcement:** minimum 2-#4 continuous in the bond beam, or the area required by
      the Phase 6 wind-panel strip check, whichever is greater.
    - **Development:** bars developed into **each** grouted jamb pier per TMS 6.1.2, with the required
      `l_d` computed and printed; hooked where the pier is too short for straight development.
    - **Retrofit sequence for an existing wall:** saw-cut and remove the face shells of the bond-beam
      courses, place and lap the horizontal bars, grout solid, cure to `f'm`, **then** drill for rods.
      This is folded into the mandatory installation-sequence block so there is one ordered list.
    - **The bond beam is DESIGNED, not merely specified** (rev 6, Codex Round 4 #4 — mandating grout
      and 2-#4 does not prove it can deliver the wall load to discrete rods). Checked between rod
      columns, under every load combination, for: **gravity flexure** (continuous-span envelope over
      the rod columns for the uniform load, **plus every retained dispersed patch load at its actual
      position** — rev 7, Codex Round 5 #10: a patch load can govern a single rod interval and
      `w_total*s^2/8` alone would miss it), **shear** at the rod columns, **local bearing** where it delivers
      into each rod, and **reinforcement development** — all per TMS 9.3. Its required area feeds back
      into the "2-#4 or the computed requirement, whichever is greater" rule above, and this check
      is what finally replaces the abandoned gravity inter-bolt arching argument with real numbers.

### Phase 7 — Jamb connection and pier
31. Jamb bolt group: vertical reaction and out-of-plane reaction resolved by the **elastic vector
    method including the in-plane group eccentricity `e_group`** — the vertical reaction acts in the
    channel web plane at the opening edge while the group centroid sits back into the jamb, so
    `R * e_group` adds vector shears to the extreme bolts and commonly governs. The Phase 5 demand
    components (shear flow and the `dF` torsion couple over the end tributary length) **continue into
    the jamb group** and are included. Full limit-state suite plus J4.3 block shear. Breakout Eq. 9-4
    live with **group-overlapped projected areas** and `l_be` to the opening edge as a required input.
32. **Reaction eccentricity**: each channel's reaction acts at `+/-(t/2 + t_w/2)` from the pier
    centerline. Balanced reactions produce zero net out-of-plane moment, but the calc applies a
    **user-set unbalance (default 10%, selectable up to 100/0)** and carries the resulting net moment
    into the pier demand. *Codex Round 2 #24 argued for a 100/0 default; rejected — the rod is loaded
    along its length by grout and supported at both ends, so load sharing is enforced by rod
    equilibrium, not by fit-up. A 100/0 split would require one channel's hole to be grossly oversized
    or one channel to be absent. 10% is a generous allowance for wall irregularity; 100/0 is available
    for the engineer who wants it.*
33. **In-plane eccentric moment** from the bolt group's horizontal offset is **computed and reported**
    with a hand-off flag; it is not checked (Decision 9).
34. Pier: `P_u` = lintel reaction + load from above; `M_u` from wind over the **actual unsupported pier
    height and tributary width**, with stated top/bottom restraint; **TMS 9.3.4.4.3 moment magnifier**
    (or 9.3.4.4.2 P-delta if applicability limits are met — the calc checks which applies);
    interaction against the supplied reinforcement; 9.3.3.5 / 9.3.4.2.2 flags.
35. Publish the reaction on the AREv2 bus; cross-reference `masonry-lintel-jamb` (REK-04) and note
    that it is ASD/REK-04 while this is strength design, so the two will not agree numerically.

### Phase 8 — Deflection
36. Gravity: **superposition** over UDL and every patch load, service D+L, on `2*Ix`, vs `L/600`.
37. **Wind — THE SHIPPING CHECK (default, non-composite):** superposition over UDL and every patch
    load at **`0.42W`** (IBC Table 1604.3 note f) on **non-composite `2*Iy`**, versus **`L/240`**
    (rev 12 — this item still carried the superseded `L/600`-at-full-`W` basis; Codex Round 7 #6).
    Reference anchor: `1.050 in` against `1.400 in`, **DCR 0.75**.
    Print alongside it the **finish category, the Table 1604.3 row, the note-(f) basis, and a warning
    that project-specific criteria may be stricter** — `L/240` is the exterior-wall-with-brittle-finish
    minimum, not a universal project criterion.
38. **Wind — optional composite mode only, informational:** STAGED, never a Boolean stiffness switch
    (rev 10, Codex Round 6 #4-#7 — rev 9 kept the stage-1 locked-in moment for strength but discarded
    the stage-1 deflection, which is inconsistent):
    ```
    delta_wind = delta_noncomposite(w_slip) + delta_composite(w_w - w_slip)
               = 5*w_slip*L^4/(384*E*2*Iy) + 5*(w_w - w_slip)*L^4/(384*E*I_comp)
    ```
    Pure `I_comp` **may never be substituted while `w_slip > 0`**; if `w_slip >= w_w` the case is fully
    non-composite. A **qualified weld has `w_slip = 0` and no staged term at all** — staged clearance
    analysis applies to bearing-type connectors only (Round 7 #9). Evaluated at the same `0.42W`
    service basis as item 37 so the two are comparable. Reported with both bounds; **no PASS status**.
39. Combined biaxial service deflection is **not** checked — no code requires it and it is not
    practice for lintels. Second-order effects are captured instead by the B1 amplification of §Phase 3.

### Phase 9 — Installation prerequisites (added Round 1)
40. A **required-sequence block** printed on the sheet, as a design prerequisite rather than a note.
    The calculated system does not exist before this sequence completes:
    1. **Shore** the wall above the proposed opening.
    2. Saw-cut and remove the face shells of the **bond-beam courses**; place and lap the horizontal
       bars; develop into each jamb per TMS 6.1.2.
    3. **Grout** the bond beam and the rod cells solid; cure to `f'm`.
    4. Drill rod holes. **Standard holes are acceptable for the non-composite base design.**
    5. Install rods with **plate washers both faces**; grout the annulus; tighten to snug.
    6. **Only then** cut the opening.
    7. Remove shoring.

    **Composite mode only — an ADDITIONAL requirement, printed only when composite is selected:**
    the rod or a shear plate must be **welded to the channel web at every connector** to create a
    positive zero-slip connection. Reamed holes and an epoxy-filled masonry annulus do **not** achieve
    this: they leave the channel-web clearance, which is the interface the longitudinal shear crosses.
    The base design does not depend on this detail, which is why it is conditional rather than
    mandatory (rev 11).

### Phase 10 — Auto-design, UI, output
41. Auto-design searches **shape and feasible connector layout as a coupled pair**, rejecting
    geometrically impossible configurations (gage vs depth, edge distance, cell module) before
    strength ranking. Returns the lightest passing combination and why each lighter one failed.
    **Iteration contract (rev 4 — rev 3 was self-contradictory, Codex Round 2 #25).** It is a **true
    coupled enumeration**: the search space is the cartesian product of `{72 shapes} x {feasible s on
    the 8" module} x {feasible g}`, every combination fully re-checked, ranked by channel weight then
    by rod count. There is no "hold `s` fixed" step. The feature is named **"Optimize section and
    layout"** so the label matches the behaviour. A separate, clearly distinct **"Check my layout"**
    mode holds the user's `s` and `g` and only ranks shapes.
42. Two `are-draw` views: wall cross-section (both channels via `pathFromWorld`, wall, thru-rod,
    dimensions, NA) and span elevation (bolt layout, load diagram, reactions).
43. AREv2 toolbar; theme opt-in decided consistently with the chosen base CSS.
44. Unity-check table with governing row highlighted; an assumptions block listing every dismissed
    limit state **with its reason**; full TMS/AISC citation on every line.

### Phase 11 — Registration and verification
45. Register in `app/lib/calcs.ts`. The `CalcMeta` type requires **`slug, label, subtitle, htmlFile,
    category, spec, status, material, calcType, icon`** (plus optional `group`, `keywords`) — all of
    them, not just the subset rev 2 listed. Values: slug `masonry-opening-channel-lintel`, material
    `Masonry`, calcType `Beams & Flexure`, group `CMU Openings`, `status: "wip"`, spec
    `AISC 360-22 LRFD / TMS 402-22 Ch.9`.
46. **Fixture A** — reference reproduction at 2% [Phase 0 gate NOT closed — no 2% claim; see review
    log], every deviation itemized. **Stand this up as a live
    headless harness the moment the Phase 3a + 5 gravity path exists**, not at the end; every
    reference-reproduction bug found after the UI is built is rework.
47. **Fixture B** — longhand hand-check to `docs/channel-lintel-hand-check-2026-08.md`, **plus an
    independent discrete-connector comparison**: model the pair as two beams linked by discrete
    springs at the rod locations and confirm the closed-form `I_comp` and `q` are recovered as the
    spring stiffness goes to infinity, and `2*Iy` as it goes to zero. (Fixture A is gravity-only —
    the Tedds reference has no composite wind — so **it validates none of the new engineering**.
    Fixture B and the assertions below are the only things that do.)
48. **Fixture C** — machine-checkable assertions, run on every build:
    1. **Decomposition closure:** `2*N_ch*z_ch + 2*M_y,ch = M_w` to machine precision, every run.
    2. **Shear-flow integral:** sum of per-bolt `V_x` over a half span equals `N_ch` at midspan within
       one bolt of discretization — validates `Q`, `I_comp`, `q`, and `N_ch` simultaneously.
    3. **Shear-plane fixture:** the wind-dominated case above (`p=30`, `h_trib=5 ft`, `L=28 ft`,
       `s=16"`, `rows=2`) with the per-plane force hand-computed as the **full** `q*s/rows = 1.704 k`
       — full, meaning NOT halved for two shear planes, which is the over-credit this catches.
       (rev 7: rev 6 pinned 3.41 k here, which would have forced the implementation to omit the
       division by row count and contradicted the rod worked example.) Add a **row-count scaling
       assertion**: doubling `rows` halves the per-rod `V_x`.
    4. **Torsion statics:** `dF*g = w_ch*s*e` exactly; `e = e_o + t_w/2 = 1.194` for MC18x42.7.
    5. **Eq. 9-8 unity point:** `bau/Ban = bvu/Bvn = 0.6597` returns interaction `= 1.000`
       (`0.6597^(5/3) = 0.500`).
    6. **Breakout scaling:** doubling `l_be` quadruples Eq. 9-4 capacity (`Apv ~ l_be^2`) — asserted
       **only for an explicitly uncapped isolated-anchor geometry**, since wall thickness, neighboring
       cones, grout boundaries and edges truncate `Apv` in real layouts. Add separate assertions at
       **every truncation and overlap transition**. Plus the 4"-above-soffit case showing breakout
       governs mid-span.
    7. **Thick-wall monotonicity:** increasing `t` from 7.625 to 11.625 leaves Eq. 9-5 flat and must
       **not** increase the governing masonry-on-bolt capacity linearly — locks in correction #4.
    8. **Non-composite limit:** the **non-composite pair** wind deflection `= I_comp/(2*Iy) = 20.4x`
       the composite value for the anchor case. Named correctly — `2*Iy` is two channels acting
       non-compositely, **not** a single channel (rev 4, Codex Round 2 #27). Add a **separate**
       assertion for true single-channel stiffness `Iy`, which is `2x` the non-composite pair.
       And as `Iy/(A*z^2) -> 0`, `N_ch -> M_w/(2*z_ch)`.
    9. **Pier anchors:** pure-axial and pure-moment points of the P-M diagram against hand values;
       Eq. 9-21 with `P_u = 0` collapses to `w*h^2/8`.
    10. Reactions sum to applied load; sign reversal of `p` mirrors all results; `q -> 0` as
        `V_w -> 0`; the two channels' axial forces are equal and opposite.
    11. **Local rod-grout equilibrium closure** (rev 5, Codex Round 3 #20 — assertions 1-10 all check
        global channel behaviour and none check the rod free body):
        - `sum F_x = 0` on the rod: `+V_x − V_x + integral(grout reaction) = 0`.
        - `sum M = 0` on the rod: `integral(z * grout reaction) = V_x * L_g`.
        - Integrated grout reaction magnitude equals `k * L_c / 2` on each contact half.
        - Peak bearing `f_g = k/d_b` matches the value used in the TMS 9.1.8 check.
        - The **derived** `M_rod = V_x*(L_u + s*/2)` agrees with a **numerically integrated** moment
          diagram over the rod to machine precision, and hits `V_x*L_g/8` at `L_u = 0` and
          `V_x*L_g/2` at `L_u = L_g/2`.
    12. **Adverse channel-split sweep:** run the auto-designer at 50/50, 60/40 and 100/0 sharing for
        **both gravity and wind** and report how the selected section changes, so the judgment in
        Risk 8 is visible rather than buried.
    13. **Combined gravity-plus-wind rod closure** (rev 6, Codex Round 4 #15 — assertions 11 validate
        only the antisymmetric wind model). Under the governing simultaneous combination, assert:
        rod equilibrium in **both** planes; `M_res = sqrt(M_wind^2 + M_grav^2)` matches a numerically
        integrated biaxial moment diagram; `V_res = sqrt(V_x^2 + V_y^2)` matches the integrated shear;
        and the von Mises value matches an independent extreme-fibre computation.
    14. **Staged-slip closure:** at `w_w = w_slip` the staged result equals the pure non-composite
        result; as `c_h -> 0` it converges to the pure composite result; the locked-in moment is
        monotonic in `c_h` and never negative.
    15a. **DEFAULT-MODE ZERO ASSERTION (rev 12, Codex Round 7 #18) — the most important fixture in
        the suite, because it guards the shipping branch.** With `compositeMode = FALSE`, assert
        **`q = N_ch = V_x = M_wind,rod = k = 0` exactly**, that no grout-couple bearing demand is
        generated, and that the rod demand set is gravity-only plus `T_w` and `dF`. Assertions 1-3, 8
        and 10-11 all validate optional composite mechanics and none of them establish this.
    15b. **NON-COMPOSITE REFERENCE FIXTURE (rev 12, Codex Round 7 #19) — the pinned shipping
        behaviour.** Reference geometry, `50/50` sharing, governing combination named explicitly.
        Must reproduce all five: wind deflection **0.75**, wind flexure **0.37**, H1-1b interaction
        **0.73**, gravity-only rod bending **0.72**, gravity grout bearing **0.17**.
    15c. **Connector governance regression** — the fully specified worked anchor in §The connector
        mechanism item 4, every input listed there including `g = 12"` and the `T_w` / `dF` tension
        branches. Two assertions, because rev 8 pinned only the first and drew the wrong conclusion
        from it (rev 9):
        - **Rod steel:** FAIL for 3/4" A307 at **52.93 ksi, DCR 1.63**; PASS for 1" A307 at
          **22.65 ksi**. Scoped explicitly to the rod-steel check.
        - **Grout bearing companion, on the SAME anchor:** `k = 0.946 k/in`, allowable
          `0.60*0.8*f'm = 0.912 ksi`. FAIL for 3/4" at **1.262 ksi, DCR 1.38** and — the assertion
          that matters — **FAIL for 1" at 1.04**, proving a bigger rod does not rescue grout bearing.
        - **Spacing-relief assertion:** at `s = 8"` with the same 3/4" A307 rod, grout DCR **0.69**
          and rod DCR **0.82**, both passing.
        - **Diameter-scaling assertion** (rev 10, Codex Round 6 #13): at `s = 16"`, **1-1/4" A307
          passes grout at DCR 0.83**, pinning that `f_g = k/d_b` scales inversely with diameter — so
          diameter is a valid lever and only *grade* is not.
49. Fable review of plan logic and implementation sequencing; Fable numerical verification of the
    finished calc. Flip `status` to `ready` only on user sign-off.

---

## Key decisions and tradeoffs

- **The rod and the grout act together as the composite connector: a transverse beam on a grout
  foundation.** Rev 1 said the grout was a shear web (wrong); rev 2/3 said the rod alone was a direct
  double-shear connector and the grout merely helped (also wrong — it does not satisfy equilibrium,
  because the two opposed end shears form a net couple `V_x*L_g`). The settled model is more demanding
  than either: it adds a **derived rod-flexure limit state** with a closed-form moment
  `M_rod = V_x*(L_u + s*/2)`, and it makes **grout bearing a checked demand on the critical path**.
  AISC E6 plays no part in this — it is retained only for built-up compression-member slenderness.
- **Steel-only composite instead of a transformed section.** The masonry would have added roughly 6%
  of `I_comp` (39 in^4 against 583) and would have required relying on tension across bed joints.
  Dropping it costs little and removes the cracked-section iteration entirely.
- **Every TMS bolt limit state enumerated, with the not-credited ones justified geometrically.**
  Eq. 9-1 and Eq. 9-6 are not credited because `Apt` is **not constructible** for a rod passing through
  hollow cells, unit webs and bed joints — a full-thickness cone would *overpredict*. That is a
  geometric fact, not a mechanism opinion, and it is stronger than either of the two earlier
  justifications this plan tried.
- **The slip question is settled by NOT depending on composite action** (rev 11, superseding three
  earlier positions). Corrected kinematics killed composite engagement with standard holes; Codex
  Round 6 then showed the proposed reamed-hole-plus-masonry-epoxy remedy fixes the wrong interface,
  because longitudinal shear crosses the **channel-web hole**, not the masonry annulus. Only a welded
  connection makes composite real. Rather than hang the design on field welding, **the base design is
  non-composite and the wind serviceability target drops to the IBC minimum (`L/240` at `0.42W`),
  where it passes with no special detail at all.** Composite is retained as computed, reported upside
  behind the welded detail. The cost of this choice is member weight and a smaller feature; what it
  buys is **no contractor-compliance dependency in the delivered design**, which is the right trade
  for a calculator that will be sealed and handed out.
- **Two bolt rows.** Doubles drilling; converts the shear-center eccentricity from a torsion problem
  into a clean top-row rod tension plus bottom-row bearing, and the free body proves the two channels'
  torques reinforce rather than cancel.
- **Bracing must be earned, not assumed.** `L_b` and compression `KL` default to the **full span** and
  reduce to `s` only when AISC Appendix 6 brace strength and stiffness are satisfied. Rev 4 defaulted
  to `s` and contradicted itself two sections later; the full-span default removes the contradiction
  and costs nothing where the bracing is genuinely adequate.
- **A continuous reinforced bond beam is a condition of use, not a recommendation.** It removes the
  unsupported "masonry arches trivially between bolts" argument entirely, and it is standard practice
  over an opening regardless.
- **Wind serviceability at the IBC minimum: `L/240` at `0.42W`** (rev 12 — this bullet still carried
  the superseded `L/600` at full `W`). Table 1604.3 exterior-wall row with note (f). Chosen not for
  comfort but because `L/600` at full `W` has **no non-composite solution in the catalog** (needs
  `I_y = 63.9` per channel against a 17.6 maximum), so holding it would have forced a welded composite
  connector into every job. Gravity keeps `L/600` — that one is TMS 4.6 and mandated. **The sheet must
  print the finish category, the table row, the note-(f) basis, and a warning that project-specific
  criteria may be stricter** (Codex Round 7 #17).
- **Layout enumeration instead of a linear spacing solver.** Slower and more code, but the capacities
  are genuinely nonlinear in spacing (group breakout overlap, bolt-group moments, edge distances).
- **Jamb pier in scope, in-plane reported but not checked.** A clean, stated boundary.

---

## Risks and open questions

1. **The 2.5% load discrepancy in the Tedds reference is still unexplained.** Fixture A must resolve
   it before the 2% tolerance can be judged met; if it cannot, the fixture must be restated.
2. **TMS 9.1.6.3 is applied by analogy to a thru-rod.** It is **informational and not demonstrably
   conservative** — the independently justified rod, washer, face-shell, grout and bond-beam checks
   govern where they are lower. ASTM C1892 testing is the escalation path if a job needs it.
3. **`L_u` is mode-specific, and in the shipping mode it barely matters** (rev 12, Codex Round 7
   #14/#15). In **composite mode** it is the single most consequential free parameter — the rod moment
   varies by a factor of **4** between full contact (`V_x*L_g/8`) and no grout credit (`V_x*L_g/2`) —
   and it defaults to the physical bound `t_w/2`, which is only defensible alongside the filled
   annulus that composite mode requires anyway. In the **default non-composite mode the antisymmetric
   `k`-field does not exist at all**; the only contact assumption is the **gravity bearing length**
   used in `M_grav = (P_rod/2)*(L_g/2 - L_c/4)`, which takes `L_c` from the **ordinary installation
   specification** (annulus grouted solid, no epoxy required) and is subject to its own sensitivity
   check. That parameter is stated independently rather than inherited from composite assumptions.
4. **Grout bearing is on the critical path IN COMPOSITE MODE ONLY.** The rod's double-curvature
   equilibrium requires distributed grout reactions, so annulus quality is a structural dependency
   wherever composite action is used. In the non-composite base design `V_x = 0` and the only grout
   demand is gravity bearing, which is not close to governing (DCR 0.17 at the reference case).
5. **Slip is retired as a risk by not relying on composite action** (rev 11). The base design is
   non-composite at the IBC wind serviceability minimum, so **no field detail has to be verified for
   the delivered capacity to be real** — the single most valuable outcome of this whole review.
   Composite remains available as reported upside behind a welded connector detail; if an engineer
   takes that route, contractor compliance becomes a field-verification item on that job.
5b. **Rod bending is the tightest connector item in the non-composite base design** (DCR 0.72 at the
   reference case) and the reference calc never checked it. In composite mode grout bearing becomes
   the binding constraint instead, relieved by spacing and by rod diameter but never by rod grade.
   Expect the composite-mode auto-designer to drive `s` down to 8" o.c. on
   wind-exposed openings.
6. **`f'm` of existing masonry is rarely known.** The required-basis input and its warning are the
   mitigation, not a solution.
7. **Pier check basis differs from the sibling ASD calc** and will produce different numbers; this
   must be stated so a reviewer is not surprised.
8. **Unequal load sharing between the two channels** is handled by a user-set unbalance defaulting to
   10%, with 100/0 selectable. **This is engineer judgment and the output labels it as such** — rod
   equilibrium argues strongly for near-50/50, but hole clearance, grout contact and support stiffness
   can differ, and that argument is not a verified result. Auto-design verification includes an
   adverse-split sweep.

---

## Out of scope

- Deriving ASCE 7 wind pressures (use `asce716_cc_wind_calculator`).
- In-plane shear wall behavior of the wall; in-plane pier capacity (reported, not checked).
- Seismic load cases and seismic detailing of the opening.
- Shoring design and means and methods (but the required sequence is a printed prerequisite).
- Lintels in brick veneer, cavity walls, multi-wythe composite walls, or clay tile.
- Fire protection or corrosion protection of the exposed channels.
- Gravity-direction masonry spanning between bolt columns (stated non-check, reasoned).
- Designing the wall above the opening as a deep beam or checking arching capacity.
- Revit / Calc State v1 integration (that contract covers three flagship calcs only).
- Fatigue, blast, and vehicle impact.
