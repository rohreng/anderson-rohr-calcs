# MWFRS — sloped roof lateral load, eave input, §27.1.5 minimum (2026-09-25)

## Problem
For Gable/Hip (and monoslope, mansard) roofs the calc priced the Fig. 27.3-1 roof Cp as psf only.
Story forces, base shear and the are.lateral.v1 handoff carried wall + parapet only; walls ran from
grade to the mean roof height; the elevation drew a flat box. §27.1.5 minimums were text only.

Reference case (26-064-RLV): 7-16, 110 mph, Exp B, 130 × 31 ft, ridge E–W, 9:12, one 12 ft story.
Old output 2.37 k (Wind-X) / 12.94 k (Wind-Y) with h = 12 entered as mean height.

## Decisions (Nick, 2026-09-25)
- Sloped walled roofs: enter the **eave height** (top of wall). Mean h = eave + rise/2 (θ ≤ 10°: h = eave), ridge = eave + rise.
- Send the **§27.1.5 minimum** downstream: each level's diaphragm force = max(design, minimum).
- Everything above the eave goes **100% to the roof diaphragm**.
- Draw **both** Wind-X and Wind-Y elevations with the real roof profile.
- Implement all roof types now.

## Method
- Walls stop at the eave; qh stays at mean h.
- Roof horizontal: F = qh·G·(Cp,WW − Cp,LW)·A_proj, windward case giving the larger resultant, floored at 0
  (Fig. 27.3-1 note: horizontal shear not less than neglecting the roof). External pressure only (GCpi cancels). θ < 10° → 0.
- Gable / monoslope end-wall triangle ½·span·rise is wall: F = qh·G·(0.8 − Cp,LW).
- Hip (equal pitch): end planes ½·span·rise are roof (Fig. 27.3-1 with L along the ridge); normal silhouette is a trapezoid, ridge length Lr − span.
- Monoslope, normal direction: both wind senses on the rise band, larger governs.
- Mansard: new slope-rise input; windward slope Cp,WW, top + leeward slope Cp,LW, both directions.
- §27.1.5 per level: 16 psf × (trib. wall + triangle / monoslope tall-wall band + parapet) + 8 psf × projected roof.
- Legacy files (no eave): eave = h − rise/2 with a warning. Saved JSON v4; AREv2 shim defaults for #hEave/#roofEnds/#mansardRise.
- Handoff: F_wind = governing F_net; additive F_roof_*, F_gable_*, F_min_*; geometry eave_ft/ridge_ft/roofEnds when supplied.

## Result, reference case with eave = 12 ft
Wind-Y 31.46 k (wall 13.18 + roof 18.28). Wind-X 5.86 k (§27.1.5 minimum governs over 4.81 k design).

## Tests
`tools/test-mwfrs-wind.mjs` block 12 (typed from first principles) plus updated 7-22 C3/C6 expectations; sloped
baseline cases allowlisted for wall/force paths; flat baselines unchanged.
