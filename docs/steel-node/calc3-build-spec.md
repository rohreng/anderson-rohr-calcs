# Composite Stud / Slab Blockout Verification — Build Specification

Implementation: `public/Calcs/composite_stud_blockout_calculator.html`, version 1.0.0. Design basis: AISC 360-22 LRFD. Shape source: embedded subset copied from the repository AISC Shapes Database v16.0.

## 1. Scope and global rules

The member is a simply supported, positive-moment composite W-beam. Zero-moment stations are the supports. Direct RISA entry is authoritative; the convenience solver is limited to a full-span uniform factored load plus point loads. Left and right support-to-maximum-moment segments are never pooled. Every check is PASS, FAIL, or REVIEW. The overall state is FAIL if any check fails, otherwise `REVIEW REQUIRED (n items)` if any review remains, otherwise PASS. Invalid or non-finite input blocks calculation.

The report carries Node ID, project, revision, shared inputs in fixed order, a deterministic FNV-1a input fingerprint, assumptions, edition, shape database version, date, and the unstamped artifact-checksum placeholder required before deployment.

## 2. Stud nominal strength — AISC 360-22 §I8.2a

With stud area `A_sa = πd_s²/4` (in²), concrete strength `f'c` (ksi), unit weight `w_c` (pcf), modulus

`E_c = w_c^1.5 sqrt(f'c)` (ksi),

the implemented AISC customary-unit form is dimensionally interpreted exactly as published: numeric `w_c` in lb/ft³ and numeric `f'c` in ksi produce numeric `E_c` in ksi. Stud nominal shear strength is

`Q_n = min[0.5 A_sa sqrt(f'c E_c), R_g R_p A_sa F_u]` (kips),

because ksi × in² = kip. The UI exposes no deck, deck parallel, and deck perpendicular; studs per rib; and weak/strong rib position. The implemented §I8.2a User Note factors are:

- No decking, with the stud welded directly to the steel shape: `R_g=1.0`, `R_p=0.75`.
- Deck ribs parallel to the beam: `R_p=0.75`; `R_g=1.0` when `w_r/h_r ≥ 1.5`, and `R_g=0.85` when `w_r/h_r < 1.5`. The `R_g=0.85` table entry is footnoted for a single steel headed stud anchor. Therefore, `w_r/h_r < 1.5` with more than one stud per rib/row opens a REVIEW gate as outside the tabulated domain; the displayed calculation uses `R_g=0.85` provisionally and cannot produce an unqualified overall PASS.
- Deck ribs perpendicular to the beam: for 1, 2, or 3+ studs per rib, `R_g=1.0, 0.85, 0.70`, respectively. `R_p=0.60` for the weak position (default, per Commentary recommendation) and `R_p=0.75` for the strong position at mid-height.

The factors, geometry branch, and applicable footnote print with the calculation. A nonblank external RISA Qn override replaces calculated Qn and is conspicuously flagged.

Applicability checks are `d_s ≤ 0.75 in`, `d_s ≤ 2.5t_f` unless over the web, installed height `h_s ≥ 4d_s`, height above deck top ≥ 1.5 in, concrete cover ≥ 0.5 in, positive rib dimensions, longitudinal spacing ≥ `6d_s`, transverse spacing ≥ `4d_s`, and intact-interface maximum spacing ≤ `min(8t_slab,36 in)` per §§I8.2c–d. The opening is excluded from maximum-spacing measurement; it is a discontinuity, not a spacing gap.

## 3. Bare steel strength and concentrated load provision

For a compact, laterally supported W-shape at the station, Chapter F is represented by the stated assumption

`M_s = φ_b M_p = 0.9 F_y Z_x / 12` (kip-ft),

where `F_y` is ksi and `Z_x` is in³. For each point load strictly between its zero-moment support and `x_Mmax`, Commentary §I3.2d / old LRFD N₂ requires, only on that same segment,

`N_2 ≥ N_1 (M_L − M_s)/(M_max − M_s)`.

`N_1 = R_segment/Q_n`, where `R_segment` is the directly entered required connector strength for the full segment; `M_L` is factored moment at the load; and connector counts map through `N=ΣQ_n/Q_n`. If `M_L ≤ M_s`, the provision is not applicable and the reason prints. If `M_max ≤ M_s`, composite action is not required for flexural strength in that segment and N₂ is suppressed with the reason. The relationship is never projected across Mmax.

## 4. Convenience moment solver

For span `L`, uniform load `w`, and point loads `(P_i,a_i)`, reactions are

`R_B = [wL(L/2)+Σ(P_i a_i)]/L`, `R_A = wL+ΣP_i−R_B`.

At station `x`, `M(x)=R_A x−wx²/2−Σ[P_i max(0,x−a_i)]`. Candidate maxima include supports, point-load stations, and each interval root of shear `R_A−wx−Σ(P_i left of x)=0`. The largest candidate is reported as Mmax and its station; moments at every load station use the same closed form.

## 5. Layout, segments, opening, and effective width

Supported layouts are single-row uniform, two-row paired uniform with transverse gauge, and perpendicular-deck rib occupancy. Each stud has explicit `(x,y)` coordinates. A stud is removed when `x_open,min ≤ x ≤ x_open,max` and `y_open,min ≤ y ≤ y_open,max`; boundaries are inclusive. No count-only override exists. Staggered/irregular input is a blocking validation error; an as-built regularity confirmation left unchecked opens a REVIEW gate.

Provided connector strength is `ΣQ_n` from remaining stud coordinates in each support-to-Mmax segment. N₂ supply counts only remaining studs between the load and its zero-moment support. Local §I3.1a effective width is reported using `b_eff,side=min(L/8, distance to slab edge/beam spacing)` for the entered controlling side-distance, with the opening-width reduction reported as a local perturbation. Slab compressive load transfer around the opening is always REVIEW. A collector passing through opens a diaphragm-continuity REVIEW gate. Edge clearance and deck rib occupancy are reported/checkable construction geometry.

## 6. Direct-entry validation and assumptions

The direct mode enforces `0<x_Mmax<L`, all point-load stations inside the span and consistently assigned to their geometric side, positive moments, `M_L≤M_max`, positive per-segment connector demands, and a printed checkbox confirming that moments and connector demands use the same signed LRFD combination. Shared dimensions, openings, shape properties, and every arithmetic intermediate must be positive and finite. Non-simple-span, partial uniform, applied-moment, continuous, cantilever, seismic, and strut-and-tie models are outside scope.
