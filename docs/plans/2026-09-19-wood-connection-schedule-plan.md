# Plan: Wood Connection Schedule calculator (NDS 2018 Ch. 11–12)
_Locked via grill — by Claude + Nick, 2026-09-19. Rev 3: rev 2 folded in Fable's NDS
cross-check (`2026-09-19-wood-connection-schedule-nds-crosscheck.md`, cited as XC-§);
rev 3 answers Codex round 1; rev 4 answers round 2; rev 5 answers round 3; rev 6 answers round 4; rev 7 = Codex round 5 APPROVED + two doc cleanups._

## Goal
A per-project web calculator on calcs.andersonrohr.com that replaces
`Wood Spreadsheets\Connections\_ NDS_11.3.1_Lateral_design_values_Z.xlsx`.
One page lists every dowel-type wood connection on a job as a schedule: project-level
inputs once at the top, then three tables — **Bolts**, **Nails**, **Screws** (wood screws +
lag screws) — where each connection is a mini-table: a summary row (description, required
shear V and withdrawal T **per fastener**, Z', W'·p_t, D/C, status) with an indented
sub-row of that connection's inputs and adjustment factors. ASD only, NDS 2018 (the edition
on the server: `Technical Resources\Wood\Wood Codes and Technical Guides\Wood Codes\NDS -
2018\`; page cites are printed page / PDF page). Print expands every derivation. Engine is
DOM-free with fixtures that reproduce the NDS tabulated Z, W and C_g values.

## Approach

### 1. Frozen contract before any parallel work
`docs/superpowers/specs/2026-09-19-wood-connection-schedule-spec.md`, written by Claude and
reviewed before subagents start. It contains:
- **Units and load level, frozen:** all lengths `in`, forces `lb`, stresses `psi`, E `psi`,
  angles `deg`. Demands are **ASD-level per fastener**: `V_asd_lb`, `T_asd_lb`. The engine
  applies no load factors (unlike the shearwall engine, which takes strength-level forces).
- **State model** (`WC.ENGINE = {name:'wood-connection-schedule', version:1, rev}`):
  `{version:1, header:{...}, bolts:[row], nails:[row], screws:[row], rowCnt}` with stable
  per-row `id` (monotonic `rowCnt`, never reused; duplicate = new id; reorder = array order).
  Every row key, its type, default, unit and "active when" condition is tabulated per
  fastener type. Blank ≠ zero: numeric fields are `null` when blank. **Authoritative row
  status table** (the engine, the UI badge, the summary counts and every fixture use these
  five values and nothing else):
  | status | when |
  |---|---|
  | `invalid` | any rejected input: non-finite or negative number; a dimension, area, E, G or F_e that is not > 0; a count (n, rows) that is not a positive integer; D > 1 in; G out of range; unsupported combination (e.g. θ ∉ {0, 90}, lag with steel main, T on a bolt). Validated in the engine before any arithmetic; fixtures for E = 0, w = 0, n = 0, n = 2.5 |
  | `incomplete` | any **active** required input is `null`, including a blank V or a blank T on a row where that demand field is active (nails/screws: both V and T are active; bolts: only V is active and T is not rendered, so `null` T is not a missing input) |
  | `fail` | a fatal flag (p < p_min, geometry below a hard minimum, refused end-grain withdrawal, 5 in spread without detailing) — evaluated **before** demand is looked at, capacities suppressed — or, with demand present, D/C > 1.0 |
  | `nodemand` | no fatal flag and all active demands are numeric 0 — capacities reported, not counted as pass |
  | `pass` | none of the above and D/C ≤ 1.0 |
  Precedence top to bottom (fatal geometry always beats `nodemand`). The summary counts
  `fail` rows independently of D/C, so a geometry failure with no number is still counted.
  Fixture: (0, 0) demand with a lag at p_excl < 4D → `fail`. No blank ever becomes 0 and passes.
- **Result shape per row:** resolved inputs (every length actually used: p_tot, p_min,
  l_m, l_s, p_t, l/D), member properties used (G, E, F_e∥/⊥ per member), yield modes with
  the governing one named, R_d / K_θ / K_D, each adjustment factor with its clause, Z, Z',
  W, W', Z'_α, demand ratios, `status`, `flags[]` (fatal), `warnings[]`, `notes[]`
  (printed engineer checks), `cites[]`. Project summary: worst D/C per table **plus** a
  count per status of the authoritative status table above (fail counted independently of
  D/C) and a count of rows carrying unresolved engineer checks.
- **Browser adapter (Tier B, `docs/calc-state-spec.md` §9 pattern, same as
  `stacked-shearwall`):** `AREv2.registerAdapter({version:1, ownedFields:['#schedule'],
  schema:{allowedKeys, maxDepth, maxNodes, maxStringLength, stringPattern}, getModel,
  setModel, runAndSettle})`. The adapter owns the three tables; header inputs are ordinary
  Tier-A fields outside `#schedule` and `runAndSettle()` re-reads them into state after
  every load (DOM is the single source of truth for the header). `setModel` refuses
  `version !== 1`. A §9 table row is added to `calc-state-spec.md`.
- Representative JSON: one full state with one row per table, the matching result JSON,
  and a save → clear → load round-trip expectation.

### 2. Project header (once)
- **Species list** (both main and side members pick from it; side defaults to the main
  species per row): G from Table 12.3.3A (p.87/101) and a default reference E (No. 2 grade,
  Supplement Table 4A/4B) for exactly the species with both values recorded in the spec:
  DFL 0.50 / 1.6M, DF-South 0.46 / 1.2M, HF 0.43 / 1.3M, SPF 0.42 / 1.4M, SPF-South 0.36 /
  1.1M, SP 0.55 / 1.4M. Species outside this list are not offered (no half-defined rows).
  E is editable per species and used only in C_g.
- **One Custom (SCL) species slot:** name, G, E, softwood/hardwood flag, three typed
  bearing strengths — F_e (D < 1/4 in), F_e∥ and F_e⊥ (D ≥ 1/4 in) — and the ESR / report
  line that qualifies them and G (free text, printed). §12.3.3.3 requires F_e for SCL from
  the ESR, so it is typed, never derived from G. The header states that the three values
  are the engineer's conservative envelope for every diameter and installation face used
  on the job; each Custom row prints the ESR line and a "SCL properties: engineer's
  envelope" note. One slot; a second product is v2.
- **Steel plate grade:** A36 hot-rolled ≥ 1/4 in F_e = 87,000 psi; ASTM A653 SS Gr 33
  < 1/4 in (gauge list 20–3 ga = 0.036–0.239 in) F_e = 61,850 psi (Tables 12B/12D/12G/12I/
  12K fn 2, 12K/12M/12P fn 2, Appendix I.2; XC-B2). E_steel = 30,000,000 psi (Table 11.3.6C).
- **Moisture:** MC at fabrication (≤ 19 % / > 19 %) and MC in service (≤ 19 % / > 19 %).
  C_M is derived **per row** per Table 11.3.3 (p.67/81) from these plus fastener type, D,
  load type and the fn 2 exception (row checkbox: one fastener / single row ∥ grain /
  separate splice plates). XC-D14/D15.
- **Temperature:** C_t per Table 11.3.4 (p.67/81).
- Code basis NDS 2018; ASD; C_D ≤ 1.6 for connections (Table 2.3.2 fn 2, §11.3.2).

### 3. Supported-product matrix (data tables in the engine, page-cited, from XC-E)
One validated matrix; anything not in it is not selectable:
- **Bolts** Table L1 (p.180/194): 1/2, 5/8, 3/4, 7/8, 1 in (D ≤ 1 in cap; XC-D1).
- **Lag screws** Table L2 (p.181/195): 1/4 – 1 in, with D, D_r, tip E, thread T, T − E per
  length. Sizes above 1 in are excluded even though Table 12.2A tabulates them.
- **Wood screws** Table L3 (p.182/196): No. 6 – No. 14 (D, D_r, T ≥ max(4D, 2L/3)).
  No. 16–24 excluded (no F_yb band coverage question — 0.268/0.294 fall in the 70/60 bands —
  but no Z-table fixture exists; v2).
- **Nails** Table L4 (p.182/196): common, box, sinker 6d–20d whose D is within the Table I1
  F_yb bands (0.099 – 0.375 in). The 0.092 in sinker 6d is **excluded** (below the band).
- **F_yb** Table I1 (p.175/189) = Z-table fn 2 values (normative source §12.3.6.1), by
  nominal D; override cell per row; unchanged by a steel side plate (XC-C5).
- **Geometry** Tables 12.5.1A–E (p.90–91/104–105) as XC-E10.
- **SDS screws: deferred to v2.** ESR-2236 lateral values, F_yb, lengths and spacing are
  product-specific; treating SDS as a No. 14 wood screw is only an ESR withdrawal
  equivalence. A separately versioned SDS product model with its own fixtures is a
  follow-on. (Nick's Q1 scope included SDS; flagged for his sign-off.)

### 4. Engine `public/Calcs/engines/wood-connections.js`, `window.WC.compute(state)`
Actual-geometry yield-limit engine. Applicability keys on **nominal D ≥ 1/4 in**, not on
fastener type (§12.5.1.1, §11.3.6.1, Table 11.3.3 fn 2).

**Members and geometry per row** (θ per member ∈ {0°, 90°})
- Main member: species (header list or Custom), thickness t_m, width w_m, load direction
  relative to grain θ_m ∈ {0°, 90°} only (v1; intermediate angles are rejected as
  `invalid` — the geometry tables and C_g areas are defined only at 0°/90°, and switching a
  near-parallel load to the ⊥ rules is not conservative for tension end distance). K_θ and
  Hankinson therefore only ever see 0 or 90.
- Side member: `wood` (species, t_s, w_s, θ_s — defaults to the main species) or `steel`
  (thickness from the gauge / plate list, **width w_s** (plate width across the fastener
  row, for gross area), grade from the header). Bolts may instead set
  `main = steel` (equations only, no fixture). Lags and nails/wood screws: steel side only
  (a lag into a steel main is not an NDS configuration, XC-B13).
- Installation face: `side grain` (default) or `end grain` (fastener axis ∥ grain of the
  member holding the point). End grain → lateral C_eg = 0.67 for **all** dowel types incl.
  bolts (§12.5.2.1), and F_em = F_e⊥ for nominal D ≥ 1/4 in (§12.3.3.x, XC-A17); withdrawal:
  lag C_eg = 0.75, wood screw / nail withdrawal **not permitted** → the row is `fail` with a
  flag only when T > 0 (§12.2.2.3, §12.2.3.3).
- Shear planes: **single** for all; **double shear for bolts only** in v1 (symmetric
  through-bolt, two equal side members, wood or steel; l_s = one side thickness, A_s = sum
  of both side areas). Double-shear lags are deferred: their penetration requirement is in
  the side members (§12.1.4.6) and the three-member thread geometry is undefined in v1.
- **Penetration from L by interval intersection** (nails, wood screws, lags). Along the
  fastener axis from the head-side face: side member `[0, t_s]`, main member
  `[t_s, t_s + t_m]`, tip `[L − E, L]` (E from Table L2 for lags, 2D for wood screws and
  nails). Thread interval for withdrawal differs by type because the clauses differ (XC-C1):
  lags `[L − T, L − E]` (§12.2.1.2 excludes the tapered tip), wood screws `[L − T, L]`
  (§12.2.2.2 states no tip exclusion), nails `[0, L]` (§12.2.3.1(c), full penetration). T
  from Table L2 / L3. Engine lengths (`∩` = overlap length, all ≥ 0):
  - `p_tot = [t_s, L] ∩ main` (physical embedment incl. any tip inside the main)
  - `tip_in = tip ∩ main`; `p_excl = p_tot − tip_in` (penetration excluding the tip)
  - `l_m = p_tot − tip_in / 2` (§12.3.5.3), `l_s = t_s` (single shear)
  - `p_t = threads ∩ main` with the type-specific thread interval above (so nails give
    p_t = p_tot and wood screws keep the tip)
  - `exits_main = L > t_s + t_m` → warning; `head_gap = L − t_s − t_m` reported
  - p_min: lag `p_excl ≥ 4D` (§12.1.4.6); wood screw and nail `p_tot ≥ 6D` (§12.1.5.6 /
    §12.1.6.4, tip included). Bolts: l_m = t_m, l_s = t_s, no p.
  Codex's case (1/4 × 6 in lag, T = 3.5 in, t_s = t_m = 1.5): threads [2.5, 5.84] ∩ main
  [1.5, 3.0] → p_t = 0.5 in, not 1.34 — fixture. Below p_min → `fail` flag, capacity not
  reported. **No table-footnote p/8D or p/10D
  scaling**: those footnotes scale *tabulated* values that assume p = 8D / 10D; the yield
  equations with actual l_m are the general method (§12.3.1). Fixtures prove the engine
  reproduces the tables at p = 8D / 10D. (Fable's final verification re-reads Table 12J/12N
  fn 3 and §12.3.1 against this reading.)
- **Toe-nails** (nails only, single shear, wood side only): §12.1.6.3 (30°, L/3 from the
  end). Frozen lengths, every one bounded by the physical joint:
  - lateral: `l_s = min(t_s, L/3)` (§12.3.10.2); `l_m = min(L·cos30° − L/3, t_m)`
    (Commentary Eq. C12.5.4-1 projected bearing length, C12.5.4.2, capped by the
    main-member thickness).
  - withdrawal: `p_t = min(L − L/(3·cos30°), t_m / cos30°)` — the actual nail length in
    the member holding the point (Commentary C12.5.4.1; the nail crosses the side member
    over L/(3·cos30°) of its length because L/3 is the projected distance), capped where
    the nail would exit the main member. Toe-nail withdrawal forces C_M = 1.0 (§12.5.4.1).
  - p_min: `p_t ≥ 6D` on the actual length.
  - C_tn 0.83 lateral / 0.67 withdrawal (§12.5.4).
  Fixtures: 16d common toe-nail 2x → 2x (l_m = 1.864 capped to 1.5; p_t = 2.153 capped to
  1.732); uncapped 8d common (L = 2.5) into a 4x: l_m = 1.332, p_t = 1.538 (not 1.667) —
  expected values computed independently in the spec, not from the engine. Claude reads Commentary C12.5.4.1–.2 (PDF p.279–280)
  while writing the spec and records the quoted text; Fable re-verifies on the shipped code.

**Strength**
- Diameter rules (§12.3.7.1, XC-C2): nails and bolts use D everywhere. Wood screws and lags
  use **D_r** inside Tables 12.3.1A/B only (Eq. 12.3-1…12.3-10, k1/k2/k3, K_D); nominal D
  everywhere else (F_e selection and √D, every "D < 1/4 in" test, xD multiples, F_yb bands,
  withdrawal equations). D > 1 in rejected (`invalid`).
- Dowel bearing strength Table 12.3.3 (p.86/100), rounded to 50 psi (fn 2): D < 1/4 in
  F_e = 16,600·G^1.84; D ≥ 1/4 in F_e∥ = 11,200·G, F_e⊥ = 6,100·G^1.45/√D; angle via
  Hankinson §12.3.4 Eq. 12.3-11; steel from the header grade; Custom typed.
- Yield limit equations Table 12.3.1A — single shear (I_m, I_s, II, III_m, III_s, IV) and
  double shear (I_m, I_s, III_s, IV) both live in 12.3.1A; reduction terms R_d from
  Table 12.3.1B: R_d = 4K_θ / 3.6K_θ / 3.2K_θ for
  0.25 ≤ D ≤ 1; K_D = 2.2 (D ≤ 0.17), 10D + 0.5 (0.17 < D < 0.25); fn 1 (nominal D ≥ 0.25,
  D_r < 0.25 → R_d = K_D·K_θ on D_r); K_θ = 1 + 0.25(θ/90), θ = max angle over members.
- Withdrawal (p.76–79/90–93): lag Eq. 12.2-1 W = 1800·G^1.5·D^0.75; wood screw Eq. 12.2-2
  W = 2850·G²·D; nail Eq. 12.2-3 W = 1380·G^2.5·D (lb/in); **bolts: T must be blank or 0,
  otherwise `invalid`** ("bolts have no NDS withdrawal value"). Range limits enforced (G
  0.31–0.73; XC-D13).
- **Head pull-through (§12.2.5):** optional per-row `W_H_lb` = the *reference* head
  pull-through value from the manufacturer/ESR (wood side member only; a steel side member
  makes pull-over a steel check → note, no input). Adjusted W_H' = W_H · C_D · C_t · C_M,H
  where C_M,H is the head pull-through moisture factor of Table 11.3.3 (its own row —
  Claude copies the exact values from PDF p.81 into the spec; it is not the nail
  withdrawal C_M) — the factor chain is pinned in the spec from Table 11.3.1 text, and
  Fable re-verifies. When blank the row prints "head pull-through per §12.2.5 not checked"
  and counts as an unresolved check. Withdrawal capacity = min(W'·p_t, W_H') when given.
- Factor chains (Table 11.3.1, p.66/80): Z' = Z·C_D·C_M·C_t·C_g·C_Δ·C_eg·C_di·C_tn;
  W' = W·C_D·C_M·C_t·C_eg·C_tn. C_D per row from a load-case dropdown (0.9 / 1.0 / 1.15 /
  1.25 / 1.6).
- **C_g — §11.3.6, Eq. 11.3-1 (p.68/82), nominal D ≥ 1/4 in only.** Frozen layout model
  (v1): rows are parallel to the load direction, every row has the same n, **staggered
  layouts are not supported** — the row inputs describe the physical layout only, they
  drive spacing, area and spread checks alike, and no "equivalent" conversion is offered;
  §11.3.6.2's offset rule is not modeled and the printout states "fasteners in aligned
  rows" as a precondition. Inputs:
  n per row, rows, in-row spacing s (along the load), row spacing g (across the load).
  Areas (§11.3.6.3, gross, no net-section deduction), evaluated **per member** from that
  member's own θ:
  - member loaded ∥ to grain (θ = 0): A = t · w (w = member width, typed).
  - member loaded ⊥ to grain (θ = 90): rows run across the grain, so g is measured
    along the grain; A_eq = t · w_group with `w_group = (rows − 1)·g` for rows ≥ 2 and
    `w_group = 4D` for a single row (the clause's "minimum parallel-to-grain spacing" =
    Table 12.5.1B full-value ∥ spacing; Claude confirms the clause text / Commentary
    C11.3.6.3 while writing the spec).
  - steel member (side, or main for bolts): A = t · w, independent of θ (gross plate
    area, §11.3.6.3; the plate has no grain, so no equivalent-width rule); a steel main
    width w_m is required the same way.
  - double shear: A_s = sum of both side members (wood or steel).
  These width fields ride the state, the UI sub-row, the print and the fixtures (a
  Table 11.3.6C cell is a steel-side fixture that needs A_s).
  E_m/E_s from the species (steel 30,000,000 psi). γ = 180,000·D^1.5 wood-wood,
  270,000·D^1.5 wood-metal (§11.3.6.1). n = 1 → C_g = 1.0 regardless of rows. Fixtures:
  Tables 11.3.6A and 11.3.6C at D = 1 in, s = 4 in, E = 1.4M (cell-by-cell, ±0.005), plus
  one hand-computed ⊥-member case (2 rows and 1 row) recorded with intermediates.
- **C_Δ — §12.5.1 (p.89–90/103–104), nominal D ≥ 1/4 in only.** Inputs: end distance,
  edge distance (loaded and unloaded where ⊥), in-row spacing s, row spacing, bearing
  toward / away from the member end (tension / compression). Rules:
  - hard minimums first: edge distance (Table 12.5.1C), row spacing (Table 12.5.1D), end
    distance ≥ the C_Δ = 0.5 value (Table 12.5.1A), s ≥ 3D (Table 12.5.1B); any violation
    → `fail` flag (not permitted; Commentary C12.5.1.2).
  - `C_Δ = min(1.0, end_actual / end_full, s_actual / s_full)`, smallest over the members
    and applied to the whole group (§12.5.1.2). Never above 1.0.
  - `l/D` for Tables 12.5.1C/D = lesser of l_m/D and Σl_s/D **over wood members only**
    (fn 1; a steel plate does not enter; Commentary C12.5.1.3).
  - "Required spacing for attached members" (Table 12.5.1B, ⊥ loading): s_full = 4D when
    the attached member is wood loaded ∥ (its own Table 12.5.1B row), 4D when both members
    are loaded ⊥ (Commentary C12.5.1.2), and 4D when the attached member is steel (the
    steel plate's own spacing is the engineer's AISC check, noted). One rule: **s_full = 4D
    for every configuration; s_min = 3D.**
  - Across-grain spread (§12.5.1.3, distance ⊥ to grain between the outermost fasteners),
    evaluated **per wood member** from that member's θ: θ = 0 → `(rows − 1)·g`;
    θ = 90 → `(n − 1)·s` (rows run across the grain there). Any sawn-lumber member with
    spread > 5 in → `fail` flag unless the row's "shrinkage detailing provided (§12.5.1.3
    exception)" checkbox is set, in which case a printed note records it. Boundary
    fixtures: one ⊥ row of 4 bolts at 2 in (6 in → fail), 2 in-line rows at 5 in (pass). Table 12.5.1E (lags in
    withdrawal only) governs when V = 0 and T > 0. Shear-area branch §12.5.1.2(b) out of scope.
- C_di §12.5.3 (1.1, nails in diaphragms, checkbox), C_tn as above.
- **Demand handling** follows the authoritative status table in §1 (invalid / incomplete /
  fail / nodemand / pass, in that precedence). With demand present: V > 0, T = 0 or T > 0,
  V = 0 → pure check, combined skipped; both > 0 → combined check. Bolts: T is inactive
  (not rendered); a numeric T > 0 on a bolt is `invalid`.
- **Combined loading** with p = p_t: α = atan2(T, V). Eq. 12.4-1 for lags/wood screws (Hankinson with cos²/sin²)
  and Eq. 12.4-2 for nails (linear cos/sin — **not** the squared form). D/C = max(V/Z',
  T/W'_cap, √(V²+T²)/Z'_α). Discriminating fixture: Z' = W'·p_t = 100 lb, V = T → nails
  reach 1.0 at 50 lb, screws at 70.71 lb.
- **Lag/wood-screw tension in withdrawal** (§12.2.1.4/§12.2.2.5 → §11.2.3): the row prints
  T per fastener and the root area A_r = π·D_r²/4 with the note "steel tension per
  fastener to be verified per the applicable metal standard" — no capacity number, counted
  as an unresolved check. Bolts/lags/screws into steel: plate bearing and net section are
  the engineer's AISC check (note).
- Bolts use nominal D on the stated precondition that threads are excluded from the
  bearing length or bear over ≤ 1/4 of it (§12.3.7.2) — printed with the §12.3.1
  preconditions; thread engagement is not modeled for bolts.
- Printed notes (no calculation): §12.1.3.2/.3 bolt holes and washers; §12.1.4.2/.3 lag lead
  holes; §12.1.5.2/.3 wood screw; §12.1.6.2 nail bored holes; §12.3.1(a)–(d) preconditions.

**Fixtures** `runFixtures()` + `tools/test-wood-connections.mjs` (`npm run test:wc`):
- Every table fixture records the **table, cell coordinates (row/column labels), full input
  set, expected value and cell-specific tolerance = half the unit of the cell's last
  printed digit** (a cell printed "480" in a table rounded to 10 lb → ±5; "121" printed to
  1 lb → ±0.5), asserted on the **unrounded** engine result as |Δ| ≤ tol + 1e-9; display
  rounding is tested separately (Table 12.2A–C → ±0.5 lb/in; C_g → ±0.005). The spec lists the exact tables per configuration from XC-E11
  (Table 12I is not a steel-main table; steel-main bolts get hand-computed expected values
  with intermediates, no NDS cell). Section numbers for end grain, multiple shear planes
  and asymmetric connections are pinned in the spec from the PDF, not carried from this
  plan; both single- and double-shear yield equations are in Table 12.3.1A and the R_d
  terms in Table 12.3.1B. Expected intermediate values (F_e, R_d, k-factors, governing mode)
  are recorded and asserted for the Fable-reproduced cells in XC-C7 (12A 480/300/220; 12J
  120/80; 12L 90; 12N 72/90/105/121 at t_s = 3/4 and 72/97/118/141 at t_s = 1).
- Coverage: bolts — single shear wood-wood, single shear steel side, double shear wood
  sides, double shear steel sides (exact Table 12A–12I letters per XC-E11 in the spec);
  steel main — hand-computed; lags 12J/12K; wood screws
  12L/12M; nails 12N/12P; withdrawal 12.2A/B/C; C_g 11.3.6A/C.
- Branch matrix: modes I_m / III_m governing (short p); D_r = 0.17 boundary; nominal 0.25
  with D_r < 0.25; p = p_min − ε (fail) and p_min; thread-interval cases (threads partly
  outside the main, tip outside the wood, Codex's 1/4 × 6 lag → p_t = 0.5); s = 3D − ε (fail), 3D, 4D, 8D (C_Δ capped
  at 1.0); end distance at 0.5 / 1.0 minima; each moisture combination × (D < 1/4, D ≥
  1/4) × (lateral, withdrawal); toe-nail; end grain lateral (bolt and nail) and end-grain
  withdrawal (lag allowed, nail refused); steel main bolt; exits_main; T on a bolt
  (invalid); (0,0) demand (`nodemand`); one blank demand on a nail (`incomplete`); bolt
  with T null (`pass`/`fail` on V alone); the combined-load discriminator above.
- The spreadsheet's "Z = 127 lb" nail case is reconstructed from its inputs (16d? D = 0.162,
  L per sheet, G 0.42, l_m 2, l_s 1.5, θ_s 90) and kept as a regression fixture only if it
  reproduces; otherwise its discrepancy is documented, not asserted.

### 5. UI `public/Calcs/wood_connection_schedule_calculator.html`
Shared toolbar (`/are-utils-v2.js`, `data-are-wide-default`, Project + Mark). Header block;
three tables inside `#schedule`; per connection: summary row + indented sub-row of inputs
(only the inputs/factors active for that type and D are rendered; inactive ones print as
"n/a" with the reason) + a "details" block that is **always in the DOM** (collapsed on
screen, expanded in print) listing resolved lengths, member properties, yield modes, the
factor chain, flags/warnings/notes and cites. Row actions: add, duplicate (new id), delete,
move up / down. Live recalc on input; the engine is the only place numbers are computed.
Input restyling scoped `!important` (are-theme-v2 rule). Summary per §1 (worst D/C per
table, per-status counts, unresolved-check count); `ENGINE.rev` printed.

### 6. Print CSS
Every connection expanded, header once, page break between tables, summary last.

### 7. Registry `app/lib/calcs.ts`
```
{ slug: "wood-connection-schedule", label: "Wood Connection Schedule",
  subtitle: "NDS 2018 Ch. 12 · bolts, nails, wood screws, lags · per-project connection schedule",
  htmlFile: "/Calcs/wood_connection_schedule_calculator.html", category: "Connections",
  spec: "NDS 2018", status: "wip", keywords: [...], material: "Wood",
  calcType: "Connections", icon: "shearwall" /* reuse until a wood-connection icon exists */ }
```
`status` is `wip` (the type allows `ready | wip | planned`) until Fable's final verification
passes and Nick has reviewed; then `ready` in the deploy.

### 8. Verification and process
- (a) Fable NDS cross-check — done (rev 2). (b) Codex review — in progress. (c) Nick signs
  off (incl. the SDS / double-shear-lag deferrals). (d) Claude writes the spec (§1), then
  subagents build engine + fixtures and UI + adapter in parallel from it. (e) Tests:
  `npm run test:wc` (engine fixtures + branch matrix), `npm run qa:roundtrip` /
  `qa:toolbar` / `qa:name` extended to the new calc (save → reload page → load → identical
  model and results, after a delete + reorder + fastener-type change), a Playwright print
  check that the details blocks are present and expanded under `@media print`. (f) Fable
  final verification: engine vs PDF clause-by-clause on the shipped code, fixture audit,
  toe-nail / p-scaling / head-pull-through readings re-checked, UI round-trip on Nick's real
  case. (g) Deploy via `/tmp/are-git` on Nick's word.
- Side finding for a separate task: `stacked-shearwall.js:437` applies the squared
  (Eq. 12.4-1) form to nails where Eq. 12.4-2 is linear — verify and fix outside this plan.

## Key decisions & tradeoffs
- **ASD only**; demands entered as ASD-level per-fastener lb; no factoring in the engine.
- **Per-fastener demand and capacity**; n appears only in C_g.
- **Actual-geometry yield engine** (real l_m, l_s, p_t) with no table-footnote scaling;
  tables are fixtures, not the method.
- **C_g and C_Δ computed** from a frozen layout model; C_Δ capped at 1.0; hard minimums
  fail the row.
- **C_M derived per row** from header moisture conditions.
- **C_D per connection.** **L entered, p derived and bounded by the receiving member.**
- **Lags in the Screws table**; **SDS deferred**; **double shear = bolts only**.
- **Steel side or main for bolts; side only for lags and nails/wood screws.**
- **One Custom (SCL) species slot** with typed F_e — a second product is v2.
- **Head pull-through** as an optional typed W_H with an unresolved-check count when absent.
- **Print fully expanded; `wip` until verified**, then ready.
- **Spreadsheet defects deliberately not carried forward:** W' formula applies C_g/C_Δ/C_d/
  C_di; combined-load formula uses COS/SIN on degrees; 2012 chapter numbers; legacy C_d;
  split-ring / shear-plate / rivet / plate / spike-grid rows.

## Risks / open questions
- Toe-nail withdrawal length (actual vs projected) and the p/8D–p/10D reading are pinned by
  the spec against the PDF text and re-verified by Fable on the shipped engine.
- Head pull-through factor chain (§12.2.5 / Table 11.3.1) to be confirmed by Fable.
- v1 refuses intermediate load-to-grain angles and staggered layouts; both are v2 items.
- Bolt/lag sub-rows carry many geometry inputs; defaults = full-value distances (4D / 7D
  end, 4D spacing, 1.5D row spacing, edge per l/D) so a typical row needs no edits.
- Tabulated Z cells are governed by modes III_s/IV, so fixtures cannot discriminate the l_m
  convention; the branch matrix adds short-penetration cases where I_m/III_m govern.

## Out of scope (v1)
- LRFD; SDS and other proprietary screws; double-shear lags and wood screws; load-to-grain
  angles other than 0°/90°; staggered fastener layouts (§11.3.6.2 offset rule); steel
  pull-over of fastener heads; split rings,
  shear plates, timber rivets, metal plate connectors, spike grids, drift pins; multiple
  shear planes (§12.3.8) and asymmetric three-member connections (§12.3.9); load at an
  angle to the fastener axis (§12.3.10.1) and the §12.5.1.2(b) shear-area branch; member
  net-section / eccentricity / row tear-out (§11.2.3, Appendix E); steel-plate bearing and
  net-section checks (noted for the engineer); concrete/masonry anchorage; glulam geometry
  limits Table 12.5.1F; lag into a steel main member; a second SCL product.
