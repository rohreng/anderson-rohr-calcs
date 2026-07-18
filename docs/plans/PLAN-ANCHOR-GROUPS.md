# Plan: Variable Anchor Count & Spacing for Masonry Anchor Calculators
_Locked via grill — by Claude + Nick (2026-07-18). Rev 4 after Codex review rounds 1–3._

## Goal
Three deployed calculators at calcs.andersonrohr.com currently hard-wire their anchor
configuration: the Masonry Top-of-Wall Anchor (`masonry_anchor_calculator.html`, ASD) is a pure
per-unit-length model (demand/fastener = S × plf, infinite-row breakout with 2 neighbor overlaps
always deducted); the Masonry Anchor Bolt shear connection (`masonry_anchor_bolt_calculator.html`,
SD/LRFD) checks exactly one bolt with hand-divided loads and only *warns* about cone overlap; the
Embed Plate — Beam Bearing (`embed_plate_beam_bearing_calculator.html`, ASD) is locked to a 2×2
four-anchor grid. Nick needs to design discrete connections — e.g. a brace delivering 13 kips
tension + 13 kips shear to the top of a wall via (4) anchors @ 8″ OC, a small ledger on 1 or 2
studs (vertical or horizontal pair, per detail 5/S802), or a 24″-wide beam embed with 6 anchors —
and trial anchor count, spacing, and orientation with a live sketch of each layout. This plan adds
those capabilities additively: every existing default input set must produce numerically identical
results after the change (any justified engineering correction to legacy numbers is a disclosed,
user-approved change — never silent).

## Projected-area method (shared by all three calcs)
- **Per-anchor Apt (tension)** = π·lb² minus closed-form circular-segment deductions: one segment
  per masonry free face the cone crosses, plus one half-lens `circSeg(lb, c/2)` per neighboring
  anchor at center distance c — enumerating only the neighbor pairs that exist for the layout
  (side at s, cross-row at g or d, diagonal at √(s²+g²)).
- **Conservatism statement (documented in shown work):** the deducted regions may mutually overlap
  (corner regions, diagonal-inside-row lenses), in which case pairwise subtraction removes area
  more than once. The result is therefore a **lower bound** on the exact no-double-count tributary
  area — always conservative for capacity, never unconservative. Diagonal deductions are retained
  for exactly this reason (they can only deepen the lower bound).
- **Independent cross-check:** the proof harness computes the exact per-anchor tributary area by
  numerical integration (union of cones ∩ masonry, points assigned to the nearest anchor —
  Voronoi share) for every smoke case and asserts `Apt_pairwise ≤ Apt_exact` and reports the
  conservatism margin. Runtime uses the closed-form value only (shown-work traceability); the
  numeric method never ships to the calc page.
- **Every anchor is enumerated** — per-anchor Apt/Apv computed for all N with its own face
  distances and neighbor set; governing anchor = minimum area (no "interior governs" shortcut).
  Results table names the governing anchor's position and which deductions hit it.
- **Per-anchor Apv (shear)** is specified separately from Apt: half-cone π·lbe²/2 toward the loaded
  free edge in the applied shear direction, minus `0.5·circSeg(lbe, s/2)` per side neighbor
  (existing TOW convention). For 2-row TOW layouts each anchor's ACTUAL Apv (its own row lbe) is
  computed and displayed per anchor; the governing design value — the nearest-row minimum, per the
  envelope argument already documented in the embed calc — is applied to the equal-share demand and
  clearly labeled as the governing value (the display never implies far-row anchors have the
  near-row area).
- **Validity restrictions (stated on all three calcs):** single named shear direction; wall ends,
  openings, and orthogonal edges assumed remote (≥ 2·lb / 2·lbe from any anchor); masonry fully
  grouted throughout the projected breakout region (explicit assumption note).
- **Geometry guards before any area math:** every row's ACTUAL coordinate validated against both
  masonry faces (near-face and far-face distances each ≥ head radius + cover — supports the
  asymmetric row-1 offset; no symmetric g/2 shortcut), g < b, center spacing ≥ max(4Ø, hardware
  footprint: head/nut-or-washer diameter + ½″ installation clearance), fit-on-plate checks.
  `Apt ≤ 0` after valid-geometry guards ⇒ error naming the deduction that killed it and suggesting
  wider spacing / fewer rows.
- **Property tests, not just smoke cases:** because the pairwise-≤-exact bound is a foundational
  assumption, the harness additionally runs randomized property tests (≥500 seeded-random
  geometries per calc spanning the full permitted input domain). For each geometry exactly one of
  two outcomes is asserted: (a) the calc rejects it with the named-deduction error — an EXPECTED
  conservative rejection (dense-but-physically-valid groups where pairwise deduction zeroes out;
  the exact area may be positive, and the test records the case as a documented conservative
  rejection); or (b) every per-anchor area is finite with `0 ≤ A_pairwise ≤ A_exact + ε`. The
  exact-area oracle specifies its discretization: grid refined (adaptively near
  circle/Voronoi/face boundaries) until the boundary-cell error bound gives
  ε ≤ min(0.5% of π·lb², 2% of A_exact), with an absolute floor of 0.01 in² for near-zero areas.

## Approach

### Phase 1 — Top-of-Wall Anchor calc: discrete-group mode
1. Add a **design-basis toggle**: `Continuous (plf)` (default, existing behavior byte-equivalent)
   vs `Discrete group (total kips)`.
2. Discrete-mode inputs: total service tension T (kips), total service shear V (kips),
   N columns (1–6) @ spacing s (in) along the wall, rows across wall thickness (1 or 2).
   Row location replaces the plf-mode lbe override in 2-row mode: enter **row-1 offset from the
   near face** and gauge g; per-anchor near-face and far-face distances derived from those
   coordinates for every anchor (no ambiguous single-scalar override). 1-row discrete mode keeps
   the existing centered/override behavior.
3. Statics: equal share — per-anchor tension = T/N_total, shear = V/N_total, N_total = rows × cols.
   A visible applicability gate (checkbox + note) states the model's premise: rigid attachment
   (plate/HSS base), load through the group centroid, no group moment or torsion — the engineer
   confirms concentricity; eccentric groups are out of scope this round.
4. Areas per the shared method above; checks A–D (min embedment, tension, shear, Eq 8-8
   interaction) unchanged in form; demand side swaps S×plf for T/N. ⅓ increase (k = 3/4 on
   demands) applies identically.
5. Results present per-anchor demand vs governing-anchor capacity (the design check), plus an
   info-only group line labeled "equal-share comparison: N × governing Ba" — explicitly NOT a TMS
   group capacity.

### Phase 2 — Embed Plate calc: rows × columns grid
6. Replace the fixed 2×2 with **rows (1–2) × columns (1–3)** selectors plus a preset layout picker
   (thumbnail buttons): 1, 2-vertical, 2-horizontal, 2×2 (default), 2×3. Preset sets rows/cols;
   number inputs stay editable (picker highlights only when it matches current values). Axes
   labeled unambiguously everywhere (UI, equations, thumbnails): columns = wall-horizontal
   spacing Sx; rows = wall-vertical gauge d. Thumbnails show V/P arrows.
7. Statics generalization — each layout gets its own free body, both load cases:
   - Shear: v = V/N per anchor (rigid group), N = rows × cols.
   - **Two rows:** anchor-couple statics are today's model — M = V·e, Tc = M/y,
     y₁ = d + e_b − a_c/2 (gravity, bottom bearing), y₂ = d + e_t − a_c/2 (reversal, top
     bearing); tension-row per-bolt T = P/N + Tc/cols; bearing C = Tc.
   - **One row:** independently derived FBD, documented in the calc's shown work with the
     equilibrium check: row at distance e_t from top edge, e_b from bottom. Gravity case —
     bearing block at bottom edge, arm y₁ = e_b − a_c/2; reversal — bearing at top,
     y₂ = e_t − a_c/2; hard error if the applicable arm ≤ 0 (mechanism). Tc = M/y resisted by
     the single row (per-bolt T = P/N + Tc/cols); bearing C = Tc from this FBD (recomputed, not
     carried over).
   - P is applied at the plate centroid (concentric axial) — same assumption as the deployed 2×2
     calc, now stated explicitly in the notes; no direct applied-moment input this round.
8. Areas per the shared method (side Sx, cross-row d, diagonal √(Sx²+d²), free-edge segment);
   2×2 must reproduce current deployed numbers (they use the same pairwise convention — any
   discrepancy found is flagged to Nick as an engineering change, not silently reconciled).
9. **Plate bending — legacy formula applied per tributary strip, decided now (not deferred):**
   - The check keeps the deployed calc's simplified bending form **M = K·T·a** — it does NOT
     introduce a new strip free-body diagram, claims no strip-level ΣF/ΣM equilibrium, and
     therefore needs no bearing/beam-reaction tributary-share formulas. It is a deliberately
     conservative per-anchor demand estimate of the same kind the deployed calc already uses,
     now applied at per-anchor granularity (documented as such in the shown work).
   - Strips: each column of anchors owns a vertical strip bounded by midpoints to adjacent
     columns and the plate edges; widths w_i sum exactly to Wp; cols = 1 ⇒ one full-width strip.
   - Per strip: M_i = K·T_i·a with T_i = that column's tension-row anchor force
     (P/N + Tc/cols), checked on S_i = w_i·t²/6; the governing strip governs.
   - Lever arm and restraint, stated per layout: **two rows** — a = governing tension row to
     plate centroid, K = 0.5, restraint basis as deployed (the two anchor rows fix the strip;
     each side cantilevers to mid-depth). **One row** — a = row line to the bearing-block
     centroid (a_c/2 from the compression edge), K = 1.0, restraint identified explicitly: the
     compression contact zone clamps the plate against the masonry (rotation restrained by
     bearing contact); the strip peels as a cantilever from that zone, pulled by the anchor row
     at its tip. The mechanism appears in both the shown-work derivation and the diagram.
   - **Complete 2×2 equivalence (moment, not just force-per-width):** the formula is unchanged,
     so legacy stress = K·Trow·a / (Wp·t²/6) and strip stress = K·(Trow/2)·a / ((Wp/2)·t²/6)
     are algebraically identical for symmetric 2 columns at equal share — same K, same a, halved
     force and width. Verified in the harness and documented as a worked 2×2 legacy-vs-strip
     benchmark in the hand-check doc. Non-uniform strips (2×3 interior, tight end distances) are
     where the per-strip check intentionally departs from a naive full-width check.
10. Fit guards: (cols−1)·Sx + 2×(bolt edge distance + hole/head clearance) ≤ Wp horizontally.
    Vertical inputs — ownership designated explicitly per layout: **two-row independents are
    Hp, e_t, e_b with d derived/display-only (d = Hp − e_t − e_b, error if ≤ min gauge);
    one-row independents are Hp and e_t with e_b derived/display-only (e_b = Hp − e_t)**. No
    mismatch state can exist. Columns are centered on the plate width by default (stated in the
    UI); strip boundaries derive from those actual column coordinates and the plate edges.
    Masonry bearing check machinery unchanged in form, but C always comes from the active
    layout's FBD.

### Phase 3 — SD Anchor Bolt calc: bolt line
11. Add N bolts (1–6, default 1) @ spacing s, single row on the wall face. **Load-field semantics
    never change silently:** existing per-bolt fields keep their meaning; a visible demand-basis
    selector adds `Group totals ÷ N` as a second entry mode, with field labels re-rendering to
    match and the active basis printed in the results header. Saved JSON gets a version key;
    legacy saves load as per-bolt (today's meaning).
12. Real §6.3.2/§6.3.3 deductions replace the "verify manually" warning, per the shared method:
    full-circle lenses for Apt, half-cone `0.5·circSeg` convention for Apv, per-anchor
    enumeration (end bolts 1 neighbor, interior 2). Hand-checked separately for Apt vs Apv.
13. The calc's existing failure-mode enable/disable toggles: any user-excluded mode is surfaced
    in the overall banner ("modes excluded by user: …") so a passing group result can't hide an
    excluded mandatory mode.

### Phase 4 — Diagrams (are-draw.js consumers — additive only)
14. All three calcs' sketches redraw parametrically for the chosen layout: correct anchor count in
    section/plan/elevation, per-anchor breakout cones, overlap lenses, spacing/gauge/edge
    dimension strings, governing-anchor highlight, and the free-body content the equations use:
    compression block location and a_c, couple arm y, load application points and directions
    (V, P, T arrows), and shear direction. Invalid geometry (arm ≤ 0, Apt = 0) renders a visible
    error state on the sketch, not a stale drawing.
15. `are-draw.js` changes, if any, are **additive only** (36 deployed calcs consume it); verify via
    `dev/diagram-proof.html` + headless Chrome screenshots of every consumer that changed.

### Phase 5 — Verification & deployment
16. Regression proof, split in two (the pages necessarily change — selectors, notes, N-aware
    diagrams — so blanket snapshot identity is impossible):
    a. **Engineering-value invariants:** every numeric result, governing mode, and pass/fail
       status for default inputs (TOW plf defaults; embed 2×2 defaults; SD N=1 defaults) must be
       identical pre/post, asserted value-by-value, scripted headless.
    b. **Reviewed intentional deltas:** full snapshots (results text, warnings, notes, diagram
       SVG geometry, print render) are diffed; every non-numeric delta is enumerated in the
       evidence file and reviewed/approved as intentional before deploy — no unexplained diffs.
    Evidence saved per the repo's existing convention (`public/dev/audit-evidence/`, consistent
    with the July audit).
17. Smoke matrix — presets AND boundaries: TOW plf; TOW discrete 1×1, 1×4, 2×4; embed 1, 2V, 2H,
    2×2, 2×3; SD N=1, N=2, N=4; plus s = 2·lb exactly (zero lens), s just under 2·lb, g at the
    head-clearance limit, T-only, V-only, zero loads, reversal-only, and a case straddling a
    governing-mode transition. Each case: no console errors, banner renders, diagram paints, and
    `Apt_pairwise ≤ Apt_exact` (numeric integration) holds.
18. Written hand-check doc (pattern of `docs/embed-plate-hand-check-2026-07.md`): full paper chain
    for the brace case TOW 1×4 @ 8″ OC, T = V = 13 kips; area-level hand checks for TOW 2×4,
    embed 1×1, 2H, 2×3 (triple-overlap), and SD 4-bolt Apt/Apv; equilibrium check of the 1-row
    embed FBD for both load cases (anchor-couple equilibrium — a genuine FBD check); and,
    separately, the worked embed 2×2 legacy-vs-strip plate-bending benchmark (a formula-level
    hand check — the per-strip bending model intentionally claims no strip equilibrium) showing
    the two formulations produce the same governing stress.
19. Work on a feature branch; implementation delegated to Sonnet subagents with Opus review
    passes; deploy via the are-calcs-deploy skill (feature→main push) only after Nick signs off.

## Key decisions & tradeoffs
- **Mode toggle, not a new calc** for TOW — one home for the §8.1.4.3 math; plf mode byte-identical.
  (Codex's "separate fourth calculator" alternative rejected: three UIs already exist and their
  users expect the capability in place; regression risk is controlled by snapshot proofs.)
- **Closed-form pairwise deduction as the design value, documented as a conservative lower bound,
  with exact numeric tributary integration as a harness-side cross-check** — keeps professor-grade
  shown work (every deduction a printable circSeg term) while bounding the error direction.
  Runtime Voronoi clipping rejected as unverifiable-by-hand complexity.
- **Equal share + governing anchor** (not group-area union): per-anchor demand T/N vs the
  minimum-area anchor's capacity, every anchor enumerated. Group line is info-only and labeled.
- **Grid bounded at 2 rows × 3 cols (embed) / 2 rows × 6 cols (TOW) / 6 bolts (SD)** — covers every
  named use case; keeps overlap enumeration and diagrams verifiable.
- **TOW gets cross-thickness 2-row option; SD ledger calc stays single-row** — face-mounted
  multi-row groups belong to the embed calc's couple statics.
- **1-row embed: independently derived FBD** with case-specific arms and recomputed bearing;
  errors out rather than silently designing a mechanism.
- **Concentric groups only, gated by a visible applicability confirmation** — no group-moment /
  torsion / accidental-eccentricity model this round (logged as future work; the gate makes the
  restriction contractual rather than implicit).

## Risks / open questions
- 2-row TOW breakout on an 8″ wall: with realistic g, cones clip both faces heavily; the guards +
  named-deduction error must steer the user to single-row before Apt→0 surprises them.
- Per-strip bending checks are analytically identical to legacy for symmetric 2×2, but the
  1-row and 2×3 applications are new engineering — the hand-check formula verifications (and the
  one-row anchor-couple equilibrium check) are the gate before any of it ships.
- Pairwise-vs-exact conservatism margin in dense 2×3 layouts may be large (over-conservative
  designs); harness reports the margin so Nick can judge whether exact-method runtime work is
  worth a future round.
- MDG has no worked multi-anchor-group example to pin numbers to; hand-check doc is the anchor.

## Out of scope
- Eccentric/moment-resisting group distributions, torsion, accidental eccentricity; staggered or
  >2-row patterns; wall ends/openings closer than 2·lb (stated restriction).
- Weld design on the embed plate; bent-bar (J/L) anchors beyond what each calc already supports.
- Changes to any of the other 33 are-draw.js consumers beyond regression proof.
- Hub (Next.js/Clerk) changes — these are static public calcs.
- Runtime exact-clipping (Voronoi) area computation — harness-only cross-check this round.
