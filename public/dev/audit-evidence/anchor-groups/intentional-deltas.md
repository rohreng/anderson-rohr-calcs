# Intentional default-render deltas vs baseline `483408b`

Branch `feature/anchor-groups`, Phase 5 verification. This enumerates the
**non-numeric** differences visible in each calc's **default-input render**
(page load, before any input change) versus baseline commit `483408b`
(the commit immediately preceding the first anchor-group commit `c4919bf`).

Numeric default-result identity is proven separately in
`regression-invariants.json` (validated by another agent) — this file covers
only structural / textual / diagram deltas.

## Method
- Extracted the three calc HTMLs at `483408b` and served them with the **same**
  shared libraries the deployed pages use (`are-utils-v2.js`, `are-draw.js`,
  `are-state-loader.js`, `are-theme-v2.css` — all confirmed **byte-identical**
  to baseline via `git diff 483408b HEAD`, i.e. unchanged on this branch).
- Captured `document.body.innerText` of baseline vs HEAD on default load in
  headless Chrome and diffed.
- **False-delta guard:** an initial pass served the baseline without the shared
  libs; that spuriously showed the shared calc-shell toolbar (Save / Load /
  Summary / Full Calc / Expand All / Collapse / Results Hub) and the
  CSS-`text-transform:uppercase` section headers as "new." Once the shared libs
  were present in the baseline sandbox those all dropped out — they are **not**
  anchor-group changes and are excluded below.

Legend: `[intentional per plan §…]` = matches PLAN-ANCHOR-GROUPS.md; every delta
below is accounted for and none is unexplained.

---

## 1. `masonry_anchor_calculator.html` (TOW, ASD)
Default = Continuous (plf) mode, so the discrete-group inputs (T/V kips, cols,
spacing, rows, o1, gauge, applicability gate) are `display:none` at load and
correctly do **not** appear in the default render.

| # | Baseline | HEAD | Tag |
|---|----------|------|-----|
| 1 | "2. Service Loads (ASD — per unit length of wall)" | "2. Service Loads (ASD)" **+ new "Design Basis" selector** (Continuous (plf) / Discrete group (total kips)) + explanatory hint | `[intentional per plan §Phase 1.1–1.2]` design-basis toggle |
| 2 | lbe hint ends "…if the bolt is not centered." | "…if the bolt is not centered. **Not used in 2-row discrete mode.**" | `[intentional per plan §Phase 1.2]` |

No other default-render deltas. plf mode is behavior-preserving.

## 2. `embed_plate_beam_bearing_calculator.html` (Embed, ASD)
Default = 2×2 grid.

| # | Baseline | HEAD | Tag |
|---|----------|------|-----|
| 1 | Sub-title "(4) Horizontal Anchor Rods, 2×2 …" | "Horizontal Anchor Rods, **Rows × Columns Grid** …" | `[intentional per plan §Phase 2.6]` |
| 2 | — | **Preset Layout picker**: thumbnails 1 / 2V / 2H / 2×2 / 3×2, each with V + P labels, plus note "Sets Rows × Columns below (still editable). Columns = wall-horizontal (Sx); Rows = wall-vertical spacing r. Wall-face view: V = gravity (↓), P = out-of-plane tension (⊙ toward viewer)." | `[intentional per plan §Phase 2.6]` preset picker + arrow-convention note |
| 3 | — | **Rows (1–3, wall-vertical)** selector + hint (2+ rows → Hp/et/eb independent, r derived; 1 row → eb derived) | `[intentional per plan §Phase 2.6 / §2.10]` |
| 4 | — | **Columns (1–3, wall-horizontal)** selector + hint (centered on Wp, spaced at Sx) | `[intentional per plan §Phase 2.6]` |
| 5 | "Sx — Row Spacing (within a row)" + hint "…of the 2 anchors in a row." | "Sx — **Column Spacing**" + hint "…between adjacent columns. Columns centered on Wp… hidden/ignored for 1-column layouts." | `[intentional per plan §Phase 2.6 / §2.10]` axis relabel |
| 6 | Diagram axis line "Anchors: 2x2, Sx x **d**" | "Anchors: 2x2, Sx x **r**" | `[intentional per plan §Phase 2.6]` gauge→row-spacing symbol |
| 7 | "WALL-FACE VIEW — **FULL** 2×2 ANCHOR GROUP APT" | "WALL-FACE VIEW — 2×2 ANCHOR GROUP APT" (+ new diagram annotations **GOV T+V, GOV V, V, P, (out)**) | `[intentional per plan §Phase 4.14]` governing-anchor highlight + V↓/P⊙ arrows |
| 8 | "diagonal overlap deducted in calc, not shaded" | "**2 diagonal/other overlap(s)** deducted in calc, not shaded above" | `[intentional per plan §Phase 2.8]` all-pairs enumeration wording |
| 9 | eb hint "Bottom plate edge to bottom anchor row." | "…bottom anchor row **(independent input for multi-row layouts).**" | `[intentional per plan §Phase 2.10]` |
| 10 | d hint "= Hp − et − eb (vertical distance between the two anchor rows)." | "…**(vertical gauge between the two anchor rows). Min gauge 2″ (hard error below).**" | `[intentional per plan §Phase 2.10]` |
| 11 | P-tension hints (×2) end "…(P/4 each)[, added to couple tension]." | "…**P applied at the plate centroid (concentric) — no applied moment.**" | `[intentional per plan §Phase 2.7 / §2.13]` explicit concentric-P assumption |
| 12 | — | Hidden diagram error-state placeholder text "GEOMETRY INVALID" now present in `#eErrGroup`/`#rErrGroup` (display:none at load; shown only on invalid geometry) | `[intentional per plan §Phase 4.14]` invalid-geometry sketch error state |

## 3. `masonry_anchor_bolt_calculator.html` (SD bolt, LRFD)
Default = N=1.

| # | Baseline | HEAD | Tag |
|---|----------|------|-----|
| 1 | Plan-view diagram caption "Apv shear half-cone (looking down)" | "**1 bolt; Apt/Apv cones, overlap lenses; governing bolt highlighted**" | `[intentional per plan §Phase 4.14]` N-aware diagram |
| 2 | — | **"Number of Bolts, N"** input + hint "Single row on the wall face (1–6 bolts)" | `[intentional per plan §Phase 3.11]` |
| 3 | Spacing hint "Center-to-center. Used to check Apt overlap (overlap if s < 2lb)." | "Center-to-center; **minimum max(4do, 1.8do + 0.5 in.).**" | `[intentional per plan §Phase 3.11–3.12]` min-spacing rule |
| 4 | — | **"Demand Basis"** selector (Per bolt (default) / Group totals ÷ N) | `[intentional per plan §Phase 3.11]` demand-basis selector |

No other default-render deltas. N=1 / per-bolt default is behavior-preserving.

---

## Verdict
Every default-render delta on all three calcs maps to a specific
PLAN-ANCHOR-GROUPS.md provision (Phase 1–4). **No unexplained delta.** The
shared calc-shell toolbar and uppercase headers seen in a naive baseline diff
were confirmed to be sandbox artifacts (missing shared libs), not code changes.
