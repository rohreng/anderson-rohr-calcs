# Plan: NDS / SDPWS QAQC of the Stacked Headers & Studs and Stacked Shearwall calculators
_Locked via grill — by Claude + Nick Rohr, 2026-09-14. **Rev. 3 (final)** after Codex rounds 1–3 — VERDICT: APPROVED round 3._

## Goal
Verify that `public/Calcs/stacked_headers_studs_calculator.html` (slug `stacked-headers`) and
`public/Calcs/stacked_shearwall_calculator.html` (slug `stacked-shearwall`) meet code, then fix them.
Code baseline is what is on the ARE server: **NDS 2018 + 2018 Supplement, SDPWS 2021 with Commentary,
ASCE 7-16 §2.4.1 ASD combinations (IBC 2021 set)**. NDS 2024 / SDPWS 2021-vs-2015 / ASCE 7-22 deltas are
reported as informational only. Phase 1 is review-only: no production calculator file changes; the only
repository additions are the findings report and a scratch recompute script. Nick marks findings to act on.
Phase 2 implements the approved fixes behind DOM-free engines with pinned fixtures, updates the TIMBER
general-notes master, and deploys.

**Scope of the compliance verdict.** The report gives strength-level member and connection checks against
the sections named below. It does not give a blanket "code compliant" verdict: shear wall deflection /
drift, diaphragm and collector design, concrete anchorage, and construction-stage stability are outside it
and the report says so.

## Approach

### Phase 0 — Prerequisites (recorded at the top of the report)
- Code documents, exact paths, editions (already resolved on the server; the report records them):
  `Technical Resources - Documents\Wood\Wood Codes and Technical Guides\Wood Codes\NDS - 2018\AWC_NDS2018-withCommentary_20210917.pdf`,
  `...\NDS - 2018\AWC_NDS2018-Supplement_20210917.pdf`,
  `...\Wood Codes\Special Design Provisions for Wind and Seismic.pdf` (SDPWS 2021, approved 2020-07-22),
  `Technical Resources - Documents\Analysis\ASCE 7-16.pdf`.
- Hardware reference pinned to one edition: Simpson Strong-Tie Wood Construction Connectors catalog
  **C-C-2024** (or the newest edition available online on the review date, recorded by edition code and
  page/table) plus the governing ICC-ES reports (ESR-2330 HDU/HDUE, ESR-2105 CMST, ESR-2236 SDS, ESR-2523
  LTP4, edition dates recorded). Later editions are an explicit update, not a silent refresh.
- Deploy path: `/tmp/are-git` is a Git Bash path on this Windows machine; its `core.worktree` resolves to
  the OneDrive repo (verified 2026-09-14 in this session). The plan records the command, not an assumption.

### Phase 1 — Review (no production calculator changes)
1. **Extract the engines.** Read both HTML files end to end. Write `docs/stacked-wood-qaqc-2026-09.md`
   with a check-by-check table: what the code does, the NDS/SDPWS section it claims, the section / table /
   equation identifier with a short paraphrase or a limited excerpt (not wholesale code text), verdict
   (OK / deviation / wrong), severity (seal-blocker / must-fix / should-fix / disclosure).
2. **Reference design values.** Verify `NDS_REF` (DFL, SYP, SPF No. 2 Fb / Fv / Fc-perp / Fc / E / Emin),
   `CF_Fb`, `CF_Fc` against NDS 2018 Supplement Tables 4A / 4B. Known suspects: DFL 2x4 Fb = 1000 (Table 4A
   gives 900); SYP values look pre-2013 (2x4 Fb 1500 / Fc 1650 / E 1.6M vs Table 4B 1100 / 1450 / 1.4M).
3. **Headers (§3.3.3, §3.4, §3.10, §4.3, §4.4.1).**
   - C_L: effective length per Table 3.3.3, single span, uniformly distributed load, which has **two**
     branches (2.06 l_u for l_u/d < 7; 1.63 l_u + 3d for l_u/d ≥ 7). The 1.84 l_u form above 14.3 is
     footnote 1 for loading conditions not listed and does not apply (corrected after Phase 1, verified in
     the NDS PDF). R_B must not be clamped (code clamps at 10; §3.3.3.7 limit is 50, above which the member
     is not applicable). Compression edge continuously braced (§3.3.3.3 / §4.4.1.2) gives C_L = 1.0.
   - C_D per combination (currently hard 1.0 with D + L + S summed). No C_r on headers (decision; note it).
   - Bearing: header end bearing sits at the member end, so C_b = 1.0 (§3.10.4 requires ≥ 3 in. from the end).
     Bearing area = (n_jambs × 1.5 in.) × header width, not a fixed 1.5 in. Second interface: jamb pack end
     grain on the bottom plate, plate Fc-perp with the plate's species, area = jamb pack area.
   - Shear: §3.4.3.1 permits neglecting loads within d of the support; the calc uses V at the reaction
     (conservative; disclose, do not require).
   - Deflection: absent. Criterion IBC 2021 Table 1604.3, two separate rows: (a) live-load row Δ(L) ≤
     L/360, evaluated for L, Lr, and S each; (b) total-load row Δ(D + L) ≤ L/240 as the instantaneous
     elastic deflection, with the footnote d alternative Δ(0.5D + L) permitted only when the "dry at
     installation" box is checked (footnote d substitutes 0.5D for D in the total-load row; it does not
     replace the total-load case). NDS §3.5.2 K_cr long-term creep is a third, informational row. Limits
     project-selectable stricter.
   - Multi-ply load sharing: the calc assumes load enters through the top plate and loads every ply equally;
     state that assumption in the notes (no ply-fastening design).
4. **Jambs (§3.7.1).** C_P currently on the 1.5 in. weak axis over the full floor height with a silent
   l_e/d ≤ 50 clamp. Decision: weak-axis bracing spacing input, default 48 in. (blocking at 4 ft o.c.,
   construction-stage assumption backed by the general note); strong-axis l_e = floor height. Both axes
   are computed and retained separately (slenderness, F_cE, C_P); the governing C_P is the smaller. Remove
   the clamp: l_e/d > 50 is a hard applicability failure (§3.7.1.4). Auto-find count re-runs the envelope.
   Concentric loading is an explicit stated assumption (header reactions centered on the jamb pack).
5. **King studs (§3.9.2, §4.3.9).** Define the wind model explicitly: uniform wind pressure over the full
   story height on tributary width (opening / 2 + stud spacing / 2), simply supported plate to plate;
   no point-load-at-head shortcut and no 0.9L geometry clamp. Opening geometry outside the story height is a
   validation error. Axial demand on kings = accumulated wall gravity on the stud's own tributary width
   (jambs carry the header reaction); state it. Interaction per Eq. 3.9-3 with strong-axis F_cE1 in the
   bending denominator and C_P from the governing axis. C_r = 1.0 for kings and jambs (single or paired
   members do not meet §4.3.9's three-member, ≤ 24 in. spacing, load-distributing condition).
6. **Wall studs (§3.9.2, §4.3.9).** Combination envelope replaces the two-case check; strong-axis F_cE1 in
   the bending term; C_r = 1.15 only when spacing ≤ 24 in. and sheathing is present (eligibility predicate
   shown in the detail); pass limit 1.0 (drop 0.96). Add wind deflection: IBC 2021 Table 1604.3, H/240
   brittle finish or H/120 flexible finish at 0.42W (footnote f), finish type selectable.
7. **Load combinations (ASCE 7-16 §2.4.1).** Machine-readable combination table in the engine; every load
   component carries a type and a story of origin so only applicable combinations are generated per floor.
   Roof: Lr and S are separate effect cases enveloped, never summed and never replaced by an input-level
   maximum. Rain R is not an input of this calculator; the notes say so. E is not a header/stud load case.
   | # | Combination | C_D (NDS Table 2.3.2) |
   |---|-------------|------|
   | 1 | D | 0.9 |
   | 2 | D + L | 1.0 |
   | 3 | D + Lr / D + S | 1.25 (Lr) / 1.15 (S) |
   | 4 | D + 0.75L + 0.75Lr / D + 0.75L + 0.75S | 1.25 / 1.15 |
   | 5 | D + 0.6W | 1.6 |
   | 6 | D + 0.75L + 0.75(0.6W) + 0.75Lr / ...0.75S | 1.6 |
   | 7 | 0.6D + 0.6W | 1.6 |
   Wind enters headers/jambs only as axial through kings/studs (no uplift path in this calculator), so #7
   is evaluated for studs and kings and reported as not applicable for headers and jambs. The header calc's
   floor-to-floor accumulation carries D, L, Lr, S separately down the stack.
8. **Shearwall — sheathing (SDPWS 2021 §4.3.3, Tables 4.3A / 4.3B / 4.3C).** Verify every `SHEATHING[].Vall`
   = nominal / 2.0 (wind) against the 2021 single-nominal tables. Seismic ASD = nominal / 2.8. Remove the
   "use Column A for seismic" note. Sheathing selector carries panel type, thickness, nail size, edge
   spacing, sides, and blocked construction (perforated method requires blocked). Framing species factor
   (SDPWS §4.3.3.1 / Table footnote: SG < 0.49 reduction) with a species input. Two-sided rules (§4.3.3.3:
   same material and nailing both sides → 2×; dissimilar → per §4.3.3.3.2) implemented as checks in Phase
   2, not just reviewed. The 0.92 factor is encoded as its full SDPWS predicate (sheathing / nail / hold-down
   inside-face condition) and the detail says which condition triggered it. **Gypsum is not eligible as
   the primary sheathing of a perforated shear wall** (SDPWS 2021 §4.3.2.3: "sheathed on one or both sides
   with wood structural panel sheathing"; verified in the PDF 2026-09-14). The gypsum-only entries are
   removed from the selector; gypsum is offered only as the opposite face of a WSP wall per §4.3.5.4.2, with
   the wind-only 3.5:1 gypsum aspect limit (Table 4.3.3 note 2) and the 2.8 seismic factor. Seismic
   eligibility of the wall system is gated on an SFRS selection (ASCE 7-16 Table 12.2-1 rows A.15 / B.22
   light-frame wood walls sheathed with WSP; A.17 / B.24 light-frame walls with shear panels of all other
   materials, NP in SDC E and F; A.16 / B.23 are the cold-formed steel rows — corrected after Phase 1)
   plus SDC, mapping to the height and material limits of that row. The calc's SDPWS section citations are audited against the
   2021 numbering (perforated method §4.3.2.3, aspect ratio §4.3.3.4, C_o §4.3.5.6, anchorage and
   overturning §4.3.6.4.x); the current page cites 2015 numbers.
9. **Shearwall — perforated method (SDPWS 2021 §4.3.2.3, §4.3.3.4, §4.3.5.6, §4.3.6.4).** Segments become an
   array of full-height segment widths b_i per wall per floor (replaces aggregate `Li`). Exact per-segment
   rule (§4.3.3.4, verified in the PDF): a segment with h/b_i > 3.5 is excluded from Σb_i; a segment with
   2 < h/b_i ≤ 3.5 contributes 2b_i/h × b_i to Σb_i; otherwise b_i. **That length reduction is the only
   place the aspect ratio enters**: the tabulated unit capacity is not reduced, and C_o is computed from the
   full-height sheathed area A_fhs without aspect-ratio adjustment (Commentary C4.3.5.6). A mixed-width
   fixture (e.g. 8 ft / 4 ft / 2.5 ft segments at h = 9 ft) proves the reduction is applied exactly once.
   Other §4.3.2.3 limitations enforced: segment at each end, nominal unit capacity ≤ 2,435 plf, h ≤ 20 ft,
   uniform top and bottom elevations (stated assumption), uniform sheathing across all sheathed areas
   (item 9 of §4.3.2.3). C_o per the 2021 equation C_o = [r/(3 − 2r)]·(L_tot/Σb_i), r = 1/(1 + A_o/(h Σb_i)),
   capped at 1.0, with A_o from an opening schedule (width × clear height, h/3 minimum) — the current
   `calcCo` returns r, not C_o; the "r ≤ 5/6 maximum opening" gate has no basis in SDPWS 2021 and is
   replaced by the §4.3.2.3 limits; hold-downs at each end; **uplift anchorage of the bottom plate at
   full-height sheathing t = v_max (plf) per §4.3.6.4.2.1** (corrected after Phase 1, verified in the PDF)
   as a new row, with the §4.3.6.4.3 plate-washer note above 400 plf nominal; collector / sill anchorage
   v_max = V / (C_o Σb_i) reported; collector force outside the wall line emitted as an unresolved-design
   warning.
10. **Shearwall — overturning / hold-down (§4.3.6.1, §4.3.6.4.1).** Keep the perforated-method chord force
    form (the code's own; the chord-spacing lever arm belongs to segmented walls). For stacked walls the
    UI detail and the tests use the multi-story expression T_k = M_k / (C_o,k Σb_i,k) below; the code's
    single-story T = V h / (C_o Σb_i) is shown only as the one-story special case.
    Accumulate **forces first**, with distinct symbols: P_j = incremental level force delivered at level j
    (the input); V_k = Σ_{j ≥ k} P_j = story shear in story k; M_k = Σ_{j ≥ k} P_j · z_{j,k} = overturning
    moment about the base of story k, where z_{j,k} is the height of level j above that base. Unit shear
    v_k = V_k / (C_o,k Σb_i,k); chord force T_k = M_k / (C_o,k Σb_i,k) (equivalently Σ V_i h_i story by
    story, and equal to V h / (C_o Σb_i) for a single story). Never sum plf values computed with different
    C_o Σb_i denominators (current `v_total` loop, seal-blocker candidate). Dead-load relief = 0.6 × dead load actually
    delivered to the end chord (unfactored components stored, 0.6 applied once, force not moment); the
    current mix of a 0.6-factored distributed term and an unfactored `dl_override` is audited. Evaluate both
    lateral directions and both ends; T per end is max(0, ...), compression reported separately. Strap vs
    HDUE at floor lines; HDUE forced at the first floor; capacity look-up "first T_all ≥ T" gated on the
    catalog post-size prerequisite against the selected end post. End-post compression check (§3.7.1, C_P)
    under overturning compression + gravity. Connector-specific end-post checks: HDUE (SDS screws, no bolt
    holes) → catalog minimum post width / thickness and screw-group prerequisites only, no net-section row;
    CMST strap (nails) → catalog minimum member SG 0.50 and nail-count prerequisites, no net-section row;
    a net-section row appears only for a bolted device, which this calc does not offer. Anchor rod /
    concrete anchorage remains out of scope and the row says so.
11. **Shearwall — inputs.** Per floor: strength-level W and E **story forces delivered at that level**
    (incremental, not accumulated). Calc applies 0.6W and 0.7E (ASCE 7-16 §2.4.1 combos 5 / 7 for shear, 7 /
    8 with 0.6D for uplift), runs wind and seismic separately (2.0 vs 2.8 on sheathing; unit shear pipeline
    has no dead load; uplift pipeline has 0.6D), and reports the controlling case per check. State carries a
    `load_basis: "strength_v2"` discriminator; legacy `V_floor` records load as basis `unknown` and the calc
    blocks the run until the user assigns each floor's force to W or E.
12. **Hardware (DF/SP basis).** Published Simpson allowables for DF/SP already include the C_D = 1.6 wind /
    seismic increase; use the "160" column, apply no further adjustment, and record for each row whether the
    published value is wood-, fastener-, or steel-governed. Verify HDUE T_all, CMST T_all, LTP4, 16d, SDS
    ¼ × 4½ against the pinned catalog edition and ESRs. Replace hard-coded anchor bolt values (½ in. 1,813 lb
    / ⅝ in. 2,587 lb, suspect ≈ 2× high) with an NDS 2018 wood-side yield-limit calculation: Table 12E
    (bolt, wood-to-concrete, DFL 1.5 in. sill, dry service, non-incised, C_D 1.6) with §12.5 spacing / edge /
    end minima checked against the spacing input; concrete breakout / pryout per ACI 318 Ch. 17 is out of
    scope and the row says so. Sill species selectable (DFL / SP / SPF).
13. **Independent recompute.** Python script in the scratchpad (kept as `tools/qaqc-stacked-wood.py` only if
    Nick wants it) re-derives reference cases from first principles and compares to the **live calc**, read
    from the page with Playwright (the WRI slab method), so Phase 1 never touches the engines:
    - Shearwall: WoodWorks *Five-Story Wood-Frame Structure over Podium Slab* (Dec 2017) stacked shear wall /
      hold-down example (SDPWS 2015 basis: compare nominal-level arithmetic, then apply 2021 factors).
      Excel `Wood Spreadsheets\NEW SHEAR WALL Design Template (3 & 4 Story).xlsx` SW1 for arithmetic only.
    - Headers / studs: AWC 2015 Design Examples (`AWC_Examples2015_20190821_ABDI-Electronic.pdf`) beam-column
      / header / stud examples and the VF / LF wood breadth-depth problems for C_L, C_P, §3.9.2, bearing.
    - Tolerances: engine arithmetic vs recompute ≤ 1e-6 relative; published rounded examples ≤ 1 % with the
      rounding source documented per case. Anything outside is a finding.
    - Coverage: not one case per calc. Matrix = each species × each combination that can govern × both
      bracing axes × header l_u/d bands × opening geometries (top / mid / full height) × hold-down branches
      (HDUE, strap, negative T, both directions, post-prerequisite failure) × sheathing branches (single
      side, two-sided same, two-sided dissimilar WSP + gypsum per §4.3.5.4.2, 0.92 predicate true / false,
      framing SG < 0.49 reduction, gypsum-only rejected, segment > 3.5:1 excluded, 2 < h/b ≤ 3.5 reduced,
      nominal > 2,435 plf rejected) × persistence (AREv2 v1 → v2, shearwall JSON v1 → v2 with unknown load
      basis, foundation export v1 read by the foundation calc, v2 written and read) × invalid inputs.
      Expected values are derived in Phase 1, before any engine code exists, with derivation provenance, so
      fixtures cannot inherit the fix's errors.
14. **Informational edition deltas** section: NDS 2024 (shear design of bending members, multi-ply
    connections, fire); SDPWS 2021 vs 2015 (single nominal, 2.8 seismic factor, gypsum, C_o revision, 0.92
    factor); ASCE 7-22 (K_d relocation, C&C simplification, risk-targeted snow). "What would change if the
    server moves to the 2024 set", not applied.
15. **Deliver** `docs/stacked-wood-qaqc-2026-09.md` plus a published artifact; findings numbered H-n and S-n
    with severity; registry `spec: "ASCE 7-22"` tag on `stacked-headers` flagged for Phase 2.
    **Stop for Nick's sign-off** (decision per finding).

### Phase 2 — Fix (only findings Nick approves)
16. Flip both `app/lib/calcs.ts` entries to `status: "wip"`.
17. **Engine extraction.** Pure engines in `public/Calcs/engines/stacked-headers.js` and
    `public/Calcs/engines/stacked-shearwall.js`, loaded by the page with `<script src>` and by Node tests
    with `vm` from the same file, so page and fixtures run identical code. Window globals `HDR` / `SW` are
    the page adapter only. Each engine exposes `compute(state)` returning normalized results, `validate(state)`
    returning blocking errors, and `runFixtures()`; `?selftest=1` on the page runs them. Playwright tests
    `tools/test-stacked-headers.mjs` and `tools/test-stacked-shearwall.mjs` (`npm run test:hdr` / `test:sw`)
    assert normalized engine outputs against the Phase 1 expected values, state round-trips, legacy-record
    behavior, validation errors, print layout, and the foundation export payload, not just render and row counts.
18. **Validation, identity, fallbacks.** Central `validate(state)`: zero / negative lengths, ΣL_i > L, opening
    height > story height, NaN, zero spacing, missing wall lines, duplicate labels are blocking errors.
    Wall lines and header stacks correlate across floors by stable IDs, not array index or label text;
    continuity (a wall line or stack that skips a floor) is a validation error unless the user marks a
    transfer. Unknown sheathing / connector IDs fail loudly; no positional or default substitution.
19. **Implement approved fixes** (from items 3–12): combination table with per-combination C_D; species
    tables; jamb / king / stud bracing inputs (weak-axis spacing default 48 in., strong-axis floor height,
    both axes retained); header C_L per Table 3.3.3 band plus continuously-braced option; no C_r on headers;
    stud limit 1.0; bearing per jamb count with C_b = 1.0 and the plate interface; deflection checks;
    incremental strength-level W / E inputs with 0.6W / 0.7E / 0.6D; force-first accumulation; 2.0 / 2.8;
    segment arrays with aspect-ratio checks; uplift anchorage between hold-downs; both-direction T with
    max(0); end-post compression and connector-specific prerequisite checks; hardware table with pinned
    catalog citation and governing mode; **every catalog / ESR prerequisite and §12.5 geometry minimum
    identified in Phase 1 items 10 and 12 is implemented as a check with a fixture per hardware family
    (HDUE, CMST, LTP4, nails, SDS, anchor bolts)**, so no approved hardware finding is dropped between
    review and implementation; NDS Table 12E anchor bolt derivation; note-box rewritten to state every
    assumption above.
20. **Persistence.** Inventory: (a) AREv2 adapter v1 in each calc (Tier-A / Tier-B fields), (b) shearwall's
    own JSON export / import (`version:1`), (c) `areCalcs_foundationExport` localStorage payload to the
    integrated foundation calc, (d) frozen saved-record HTML files written by `are-utils-v2.js` (post-run DOM;
    they do not re-run, so old records stay truthful as printed). Actions: adapter and JSON versions → 2 with
    a migration that maps legacy fields, sets `load_basis: "unknown"` for legacy shearwall forces, and shows
    a banner "loaded from engine v1 inputs; results recomputed with engine v2 (NDS 2018 / SDPWS 2021)". A
    result snapshot is written into every new save with this schema: `engine` {name, build id (git short
    SHA), schema version}, `codes` {NDS 2018, SDPWS 2021, ASCE 7-16, IBC 2021}, `hardware` {catalog edition,
    ESR list}, `inputs_hash` (SHA-256 of the normalized input state), `assumptions` (bracing spacing,
    bracing option, species, load basis, finish type), `checks[]` {id, member, combination, demand,
    capacity, dc, status, applicability errors}, `governing` {per member}, `migration` {source version,
    fields mapped, fields defaulted}, `timestamp`. That is what a saved record reproduces. Foundation export payload → version 2 carrying D / L / Lr / S separately with the
    governing combination; the foundation calc's reader accepts v1 and v2. `docs/calc-state-spec.md` is
    extended with both wood slugs and example states before the migration is written.
21. **General notes.** `Drafting Libraries - Documents\GENERAL NOTES\TIMBER NOTES.docx` (master): `_backup`
    copy first, `_Master Changelog.md` entry, edit via the docx skill, render to PDF and visually check.
    Two notes, separated as permanent assumption vs contractor requirement:
    "WALL STUDS, JAMBS AND KING STUDS ARE DESIGNED ASSUMING WEAK-AXIS BRACING AT [4'-0"] O.C. MAXIMUM BY
    WALL SHEATHING OR SOLID BLOCKING." and "WHERE WALL SHEATHING IS NOT INSTALLED IMMEDIATELY AFTER
    FRAMING, CONTRACTOR SHALL PROVIDE SOLID BLOCKING AT [4'-0"] O.C. VERTICALLY UNTIL SHEATHING IS
    INSTALLED." Bracketed per the master convention.
22. **Release gate.** Re-run recompute + fixtures + Playwright; live check at desktop and print widths;
    post-fix review record appended to the QAQC report (fixture evidence, migration evidence, Nick's
    sign-off line); flip status to `ready`; deploy via `/tmp/are-git`; confirm Vercel.

## Key decisions & tradeoffs
- **Edition baseline = what is on the server** (NDS 2018 / SDPWS 2021 / ASCE 7-16), not ASCE 7-22 / NDS 2024.
- **Review first, fix second**; Nick gates every engineering change; calcs stay `ready` during review
  (Nick's call; Codex recommended `wip` from day one — flagged in the resolution).
- **True ASD combination envelope with per-combination C_D**, Lr and S as separate cases, rain excluded.
- **Weak-axis bracing at 48 in. by input** (default, construction-stage assumption backed by the general
  note), strong axis over floor height, both axes retained; unbraced is the user's override, not the default.
- **Shearwall: incremental strength-level W and E per floor**, forces accumulated before division, wind and
  seismic checked separately, controlling case reported; legacy records block until re-assigned.
- **SDPWS 2021 Table 4.3A / B / C values locked in**; segment arrays instead of aggregate ΣL_i.
- **Perforated-method T = V h / (C_o ΣL_i)** retained (code form); dead-load relief as a force on the chord.
- **Hardware on DF/SP basis from a pinned catalog edition, "160" column, no further C_D**; anchor bolts by
  NDS Table 12E wood-side yield only; concrete anchorage out of scope.
- **Header C_L default unbraced by Table 3.3.3 band** with a continuously-braced option; **no C_r on
  headers**; **stud limit 1.0**.
- **Engines in shared files run by page and Node** (window globals only as adapter); fixtures derived in
  Phase 1 before engine code; status `wip` during the fix phase; deploy path verified.

## Risks / open questions
- Simpson catalog / ESR editions change; pinned edition recorded, later editions are an explicit update.
- WoodWorks example is SDPWS 2015 / ASCE 7-10 basis; comparison is at the nominal / arithmetic level.
- Legacy shearwall saves cannot be migrated automatically (single unlabeled `V_floor`); users re-enter.
- The envelope changes accumulated jamb loads at every floor; frozen records stay as printed, re-opened
  inputs recompute with a banner.
- Uplift anchorage between hold-downs and end-post compression are new rows users have not seen.
- NDS 2024 Supplement design-value changes could not be confirmed from public sources.

## Out of scope
- NDS 2024 / ASCE 7-22 / IBC 2024 compliance (informational deltas only).
- Segmented or force-transfer shear wall methods; shear wall deflection / story drift.
- Diaphragm design; collector design outside the wall line (force emitted as a warning only); concrete
  anchorage (ACI 318 Ch. 17); anchor rod steel design.
- Rain load, eccentric jamb loading, multi-ply header fastening design (assumptions stated in the notes).
- Temporary construction stability beyond the general note.
- `4_story_shear_wall_calculator.html` and the integrated headers / grade-beam / pier calculator, except
  the export interface the header calc feeds.
- UI redesign beyond the inputs and notes the fixes require.
