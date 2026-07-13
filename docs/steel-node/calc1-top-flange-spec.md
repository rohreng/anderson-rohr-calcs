# Calc 1 — Top-Flange Local Bending Model (Pre-Build Spec)

**Status:** Blocking pre-build derivation, per `PLAN-STEEL-NODE.md` §1 ("Calc 1"). No AISC Specification
section, Design Guide, or Manual example addresses a beam top flange locally bending to deliver an
off-web bearing patch into the web. AISC 360-22 §J10.10 ("Transverse Forces on Plate Elements") is the
closest anchor point in the Specification: it applies a transverse (out-of-plane) force to a plate
element and explicitly directs the engineer to yield-line theory for flexure and a punching-shear model
for shear, citing AISC Manual Part 9 as further reading. The beam top flange, outboard of the web, is
exactly such a plate element — one edge continuous with the web (the "support"), the outer edge free,
loaded transversely by the bearing patch delivered from the HSS column base plate above. This document
derives the flexural half of that check (shear/punching is not separately checked — see §5 Validity
Limits, item 4) as a rigid-plastic yield-line mechanism, and validates it against an independently
derived elastic plate-strip bound.

## 1. Physical idealization

- The beam top flange has half-width (web centerline to tip) `c = (bf − tw)/2`.
- The bearing-pressure model (established elsewhere in Calc 1, DG24 §7.4 cap-plate analogy in reverse)
  delivers a rectangular pressure footprint at the top of the flange: length `lb` (along the beam axis,
  from 2.5:1 dispersion through the base plate thickness) × transverse width `wp` (across the flange,
  same 2.5:1 dispersion rule applied in the transverse direction), with the footprint centroid offset
  from the web centerline by `e_w`.
- **Governing side:** whichever transverse edge of the footprint extends farther from the web face
  governs. Let `a` = the distance from the web face (`tw/2` from the beam centerline) to the centroid of
  the portion of the footprint that lies *beyond* the web face on the governing side.
- **Applicability gate:** if the entire footprint lies within the web width (`e_w + wp/2 ≤ tw/2`), no
  cantilever action exists at all — the load path is directly through the web and this check is N/A
  (reported as "footprint fully over web — no local bending demand"). This mirrors §J10.10's premise: a
  force is "transverse to the plane of a plate element" only where a plate element (the overhanging
  flange) actually receives it.
- **Overhang force:** `P_over` = the portion of the total patch force `P_patch` that lies outboard of the
  web face on the governing side, computed from the footprint geometry (uniform pressure assumed across
  the footprint — the base-plate model already establishes uniform pressure over the dispersed footprint;
  see main plan §1, bearing-pressure model). `P_over = P_patch × (overhang length) / wp` when the
  footprint straddles the web face, or `P_over = P_patch` when the entire footprint is outboard.

## 2. Yield-line (rigid-plastic) mechanism

Model the overhanging flange as a plate strip of unit width, thickness `tf`, fixed along the web line
(the web and the portion of flange directly over it are far stiffer than the free-tipped overhang and are
taken as a rigid support — standard yield-line boundary idealization), free at the tip, loaded by a line
load along a yield-line hinge parallel to the web.

- Plastic moment per unit width of a rectangular section in bending: `mp = Fy·tf²/4` (kip-in/in), using
  `Fy` of the flange material and `Z_unit = tf²/4` for a unit-width rectangular strip.
- **Effective participating width** `b_eff`: a 45° yield-line fan is assumed to radiate from the two
  longitudinal edges of the loaded footprint back to the web-face hinge line (the same fan-dispersion
  logic used throughout the AISC Manual/Design Guides for locally-loaded plate elements — e.g., Manual
  Part 14 base-plate/bearing-plate cantilever methods, and the DG24 cap-plate load-spread analogy already
  adopted elsewhere in Calc 1). This gives `b_eff = min(wp + 2a, bf)` — capped at the physical flange
  width, which is the conservative (not-more-than-exists) bound.
- **Nominal moment capacity about the web hinge line:** `Mn = mp · b_eff = (Fy·tf²/4) · b_eff` (kip-in).
- **φ = 0.90**, matched to AISC 360-22 §J10.1 (flange local bending) and §J4.5 (flexural strength of
  affected elements) — both are flange/plate-bending limit states with the same φ.
- **Demand moment about the same hinge line:** `Mu = P_over · a` (kip-in) — the total overhanging force
  times its lever arm from the web face.
- **D/C = Mu / (φ·Mn)**.

## 3. Independent validation bound

A structurally distinct, independently derived solution is used to bound the yield-line result, per the
blocking-step requirement. The two solutions share only the same idealized geometry (fixed-at-web,
unit-width cantilever strip, thickness `tf`) — the mechanics assumed for each are different:

- **Yield-line (plastic) capacity:** `Mp = Fy·tf²/4` per unit width (§2 above).
- **Elastic plate-strip bound:** first-yield (elastic) capacity of the same unit-width strip,
  `My = Fy·S_unit = Fy·tf²/6`, i.e. the fiber stress reaches `Fy` at the extreme fiber of the web-face
  section under elastic (linear stress) bending — no redistribution/plasticity assumed. This is the
  classical "conservative" bound: a first-yield elastic solution is always ≤ the fully-plastic mechanism
  solution for a compact rectangular section.
- **Bounding identity:** `Mp / My = (tf²/4) / (tf²/6) = 6/4 = 1.5`, exactly the shape factor of a
  rectangular cross-section, independent of the specific input values. `validate-calc1.mjs` computes both
  `Mp` and `My` numerically from a worked fixture and asserts the ratio equals 1.500 (±1e-9) — confirming
  the yield-line formula is not simply an unchecked restatement of itself but reproduces the known
  elastic/plastic relationship for a rectangular section, and that the plastic (design) capacity always
  "bounds sensibly" above the conservative elastic first-yield capacity. The script prints both `Mp` and
  `My` for the fixture case.
- This is a **necessary, not sufficient**, validation: it confirms internal consistency of the mechanics
  (the plastic modulus is being applied correctly relative to the elastic one) but does not independently
  verify the fan-width assumption `b_eff`. That assumption is flagged as an explicit modeling judgment in
  §5.

## 4. Worked fixture (used in `validate-calc1.mjs`)

W18X50 top flange, `bf = 7.50 in`, `tf = 0.570 in`, `tw = 0.355 in`, `Fy = 50 ksi`.
HSS footprint after dispersion: `lb = 8.00 in`, `wp = 6.00 in`, `e_w = 2.00 in` (offset toward one side).

- `c = (7.50 − 0.355)/2 = 3.5725 in`
- Governing-side footprint edge from web centerline: `e_w + wp/2 = 2.00 + 3.00 = 5.00 in`
- Web face at `tw/2 = 0.1775 in` from centerline → overhang exists (`5.00 > 0.1775`)
- Footprint near edge from web centerline: `e_w − wp/2 = 2.00 − 3.00 = −1.00 in` → footprint straddles the
  web face, so the overhang portion runs from the web face (`0.1775 in`) to the far edge (`5.00 in`):
  overhang length = `5.00 − 0.1775 = 4.8225 in`, out of the full `wp = 6.00 in`.
- `P_over = P_patch × 4.8225/6.00 = 0.80375 · P_patch`
- Overhang centroid from web face: `a = 4.8225/2 = 2.41125 in`
- `b_eff = min(wp + 2a, bf) = min(6.00 + 4.8225, 7.50) = min(10.8225, 7.50) = 7.50 in` (capped at `bf`)
- With `P_patch = 100 kips`: `P_over = 80.375 kips`, `Mu = 80.375 × 2.41125 = 193.80 kip-in`
- `Mp(unit) = 50 × 0.570²/4 = 4.0612 kip-in/in`; `Mn = 4.0612 × 7.50 = 30.46 kip-in`; `φMn = 0.90 × 30.46 =
  27.41 kip-in`
- `D/C = 193.80 / 27.41 = 7.07` → FAILS for this fixture at `P_patch = 100 kips` (illustrates the check is
  binding for large `e_w` — expected; a real design would reduce `e_w` or add a stiffener under the
  overhang).
- Elastic bound: `My(unit) = 50 × 0.570²/6 = 2.7075 kip-in/in`; ratio `Mp,unit/My,unit = 4.0612/2.7075 =
  1.500` — confirms §3. (Values verified numerically by `validate-calc1.mjs` — see script output.)

## 5. Validity limits (printed on the calculator report)

1. Applies only when the bearing footprint extends beyond the web face on at least one side
   (`e_w + wp/2 > tw/2`); otherwise N/A.
2. `a ≤ c`: if the footprint's overhang centroid would fall outside the physical flange overhang, the
   footprint itself does not fit on the flange — this is caught by an upstream geometric-fit blocking
   validation (base plate/HSS must fit within `bf`), not by this check.
3. Rigid-plastic mechanism neglects membrane (catenary) stiffening, compression-flange local buckling
   interaction with global flange stress, and combined-stress interaction with the beam's global bending
   stress at the same fiber. The check is a **local** screening check; the engineer must separately
   confirm the top flange has adequate capacity for combined local + global stress at high combined D/C
   (a note is printed whenever this check's D/C exceeds 0.7).
4. Punching/shear at the web-face hinge line (the other half of §J10.10's guidance) is not separately
   checked in Calc 1 — §J10.2/§J10.3 (web local yielding/crippling) already check the web's capacity to
   receive the delivered force, which bounds the punching condition for this geometry; this is stated as
   an explicit scope limitation, not silently assumed away.
5. This is an engineering model, not a Specification-prescribed capacity — labeled on the report the same
   way as the bearing-pressure dispersion assumption (DG24 §7.4 analogy), consistent with the plan's
   treatment of both novel derivations.
