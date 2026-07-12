# Masonry audit decision register — 2026-07

Status: frozen audit inputs. These are constraints, not defects. Source hierarchy: calculator engineering notes and the frozen Rev 5 plan govern; the obsolete embed-plate action plan does not override them.

## DR-01 — Embed plate

embed_plate: Apt bearing-area deduction = one circular-segment half-lens per neighboring anchor (in-row c=Sx/2, cross-row c=d/2, diagonal c=g/2) per TMS §6.3.2 — the action-plan's "×2" is obsolete; plate bending uses the bolt-tension model M = 0.5·T_row·a (K=0.5), NOT a V·e cantilever; nt (threads/in) is intentionally under-the-hood UNC coarse by diameter; k=3/4 one-third stress increase applied per-case on all demand sides. The HTML's own engineering-notes section is authoritative over refs/Masonry/embed_plate_calculator_action_plan.md.

Locked audit expectations: one half-lens per neighbor; K=0.5; diameter-selected UNC coarse threads; k applied once and to every demand side. Source: frozen plan and the authoritative engineering-notes section in `embed_plate_beam_bearing_calculator.html`.

## DR-02 — Lintel/jamb

lintel/jamb: jamb combined check is a cracked-section P+M solver per TMS §8.3.4.2.2 (fa/Fa+fb/Fb unity is prohibited for reinforced masonry — do not reinstate it); ¼Pe slender cap = Eq. 8-10 and Pe = Eq. 8-14 in TMS 402-22 numbering; Fa = 0.30·f'm for reinforced (Eq. 8-16) with the 0.65·Ast·Fs steel term deliberately neglected (conservative, disclosed); cover_jamb default 3.81" (= b/2 centered bars); deflection uses an L≤8d waiver gate with a manual-check warning above (deliberately no auto I_eff); wind input is ULTIMATE C&C psf with ×0.6 applied exactly once.

Locked audit expectations: cracked-section P+M; Eq. 8-10/8-14 numbering; Fa=0.30f'm with disclosed steel-term omission; centered 3.81 in cover; L≤8d waiver/manual warning; one 0.6 conversion. Source: frozen plan and the existing lintel/jamb calculator notes.

## DR-03 — Governing sources and tolerance

TMS 402/602-22 governs equation form and applicability. MDG 2022 worked examples are the only numerical oracle in this round. Tolerance is the unrounded internal value versus MDG printed value within displayed precision or 0.5% relative, whichever is looser; any governing conclusion flip is a CALC ERROR. Unit conversions, display rounding, and loop mechanics are exempt from shown-work findings.

## DR-03 — Engineer-of-record rulings, fix phase (Nick, 2026-07-11)

1. **MAB-1 basis:** headed-bolt masonry crushing uses the MDG example's bolt-area basis — the TMS Eq. 6-7 net tensile stress area (0.142 in² for 1/2-13 UNC) — matching MDG 9.3-11's intent. The prior 0.127 in² (root-area) basis is superseded.
2. **RWALL benchmark mapping:** the reinforced-wall calc maps to REK-02 (out-of-plane flexure/shear), REK-03 (loadbearing axial+flexure), and REK-05 (in-plane shear design).
3. **URWALL benchmark:** MDG Table 11.3.1 (Allowable Stresses for Unreinforced Masonry) equations, with hand-calculated wall forces from standard statics (M=wh²/8, V=wh/2). Hand-derived benchmarks explicitly authorized for this calc (amends the round's "no hand derivations" bound). MDG Example 11.3-2 documents the identical method.
4. **EMBED verification:** no MDG example exists; a documented hand check of every calculation plus a global methodology overview is the accepted verification (docs/embed-plate-hand-check-2026-07.md). DR-01 methodology remains law; the hand check verifies the implementation.

**New findings discovered while building the ruling benchmarks (PENDING EOR RULING — not yet fixed):** the reinforced-wall calc's partial-grout section model uses face-shell-only area for An/I/r and BOTH shear planes (in-plane fv +52% vs MDG Anv basis; OOP shear under-predicted ~4×, unconservative), applies no 0.6 factor to the OOP wind moment inside the "0.6W" combo, and uses 0.30·f'm (vs TMS 0.25) in allowable axial (unconservative); f'm=1,750 not selectable. The unreinforced-wall calc codes Fb as 0.33·f'm vs f'm/3 (minor, conservative), has no Pe/4 buckling check and no OOP shear check, and caps h/t at 20. These are recorded in the rek-02/03/05-asd-* and urwall-6in-hand fixtures with benchmark_status pending_eor_ruling / benchmark_not_drivable.
