# Anchor-group projected-area verification harness

This standalone Node.js 18+ harness checks the conservative projected-area formulas in
`docs/plans/PLAN-ANCHOR-GROUPS.md`. It uses CommonJS and the Node standard library only.

- `geometry.js` contains the circular-segment and pairwise Apt/Apv reference formulas, adaptive
  exact tributary-area oracles, and builders for the TOW, embed, and SD calculation domains.
- `unit-tests.js` checks closed-form segment, clipping, two-circle, half-cone, and convergence cases.
- `property-tests.js` runs 500 deterministic random geometries in each of the three domains using
  a hardcoded mulberry32 seed and the plan's row, column, spacing, cover, and fit restrictions.
- `run-all.js` runs both suites, prints the summary, and writes the complete `report.json` result.

Run from the repository root:

```text
node tools/anchor-groups/run-all.js
```

Each valid non-rejected geometry asserts finite nonnegative pairwise areas and
`A_pairwise <= A_exact + epsilon` for every anchor, for both Apt and Apv. A geometry whose pairwise
deductions make any area nonpositive is counted separately as an expected conservative rejection;
this is the plan's intended response to dense groups, even when their exact area remains positive.

The adaptive oracle refines cells touching circle, edge, or Voronoi boundaries. Its reported
uncertain-cell error bound must be no greater than
`max(0.01 in^2, min(0.005*pi*R^2, 0.02*A_exact))`: 0.5% of the full circle or 2% of the exact
tributary area, with the specified absolute 0.01 in² floor for near-zero areas.
