# Anchor-group projected-area verification harness

This standalone Node.js 18+ harness proves the closed-form tributary-area design path against an
independent adaptive-integration oracle (see DR-04 in
`docs/masonry-audit-decision-register-2026-07.md`). It uses CommonJS and the Node standard library only.

- `geometry.js` contains the circular-segment helper, the closed-form tributary construction
  (`clipPolyHalfPlane` / `circlePolyArea` / `circleHalfPlanesArea` / `tributaryApt` / `tributaryApv`
  — kept verbatim-identical to the copy in the calc HTML), the retired pairwise Apt/Apv reference
  formulas, adaptive exact tributary-area oracles, and builders for the TOW, embed, and SD domains.
- `unit-tests.js` checks closed-form segment, clipping, tangency, two-circle, half-cone, and
  convergence cases, plus the 2026-08-05 12″-CMU 2×3 inversion reproduction case.
- `property-tests.js` runs 500 deterministic random geometries in each of the three domains using
  a hardcoded mulberry32 seed and the plan's row, column, spacing, cover, and fit restrictions.
- `run-all.js` runs both suites, prints the summary, and writes the complete `report.json` result.

Run from the repository root:

```text
node tools/anchor-groups/run-all.js
```

Every geometry asserts, for every anchor and for both Apt and Apv:
`|A_design - A_exact| <= epsilon` (TWO-SIDED — the pre-2026-08 one-sided
`A_pairwise <= A_exact + epsilon` assertion proved conservatism in sign but never bounded its
magnitude, which is how the pairwise A_pt inversion shipped), `A_design > 0` (a nonpositive area
is a FAILURE, not an "expected conservative rejection"), and monotonicity: increasing the cone
radius must not decrease the area.

The adaptive oracle refines cells touching circle, edge, or Voronoi boundaries. Its reported
uncertain-cell error bound must be no greater than
`max(0.01 in^2, min(0.005*pi*R^2, 0.02*A_exact))`: 0.5% of the full circle or 2% of the exact
tributary area, with the specified absolute 0.01 in² floor for near-zero areas.
