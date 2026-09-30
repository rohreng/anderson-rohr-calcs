# Plan — Stacked Shearwall Designer: dynamic Elevation view + Plan view

_2026-09-30. Fable-planned; Claude cross-check agreed on architecture. Nick answered §6 (opening positions added, §5a). Codex cross-check pending — run /co-validate on this file in a new session (MCP pinned to codex@0.153.4). Status: READY FOR REVIEW._

## 0. Summary

Two SVG views, both rendered from the same `SW.compute()` result the panes already use (no second compute), in their own container outside `#floor-con` so `render()` and the AREv2 adapter never touch them.

| View | Shows | Input the engine lacks today |
|---|---|---|
| Elevation (selected wall id, all levels stacked) | story heights, L / b_i / openings, story-force arrow per level, cumulative V and v_max, dead load, T / C each end per level, base V / T / C / t / T_req, hold-down + sill labels, h/b flags | x-positions of segments/openings (widths only), level elevations, level presence as data |
| Plan (one level at a time) | every wall at its coordinates, line force, per-wall V and v_max, lengths, end reactions, Σ check vs level force; click wall → elevation | along-line `start_ft` (absent), building B × D (in handoff record, not in SW state), `dir`/`loc_ft` for hand-added walls |

Phases: 1 engine data → 2 `engines/sw-views.js` SVG builders → 3 page integration, print, theme → 4 handoff/adapter + real-file E2E. No new wall-table column (harness 23 columns), adapter `version: 2` stays.

## 1. What the engine exposes (`public/Calcs/engines/stacked-shearwall.js`)

- `compute(state)` `:941-995` → `res.floors[k]` `{index, id, name, h_ft, base, levelLabel, P_wind_lb, P_seis_lb, walls[]}`; walls from `computeWall()` `:1183-1485`.
- `geom` (`computeGeometry` `:1017-1046`): segments `{b, hOverB, bEff, rule, f, share}`, openings `{w, hc, hEff, area, floored}`, `Ao, r, Co, sumBi, lever, maxHoverB`. Widths only.
- `cases.wind/seismic` (`computeForces` `:1068-1142`): `V, Vstrength, M, rows[] {j, P, Pfac, z, m, src, share, Vline, Vi}`, `vmax`, `dlRows[]`; perforated `ends[2] {MR, T, Traw, grav, C}` (C = M/lever + grav, no dead-load relief, `:1113`); segmented `segments[]` with own `ends`.
- `gov` `:1268-1273`, `line` `:1247`, `holdown` `:1147-1181`, `sill` `:1356`, `uplift` `:336-424` (`T_req`), `endPost` `:686-720`, `checks[]` `:1385-1475`.
- Imported walls carry `dir, loc_ft` (`lateral-handoff.js:627`); X walls run E–W, `loc_ft` from S; Y walls N–S, `loc_ft` from W (`:59-60`). Hand-added walls have neither. B/D in `record.geometry` (`lateral-handoff.js:582`) but not written to SW state.

Engine additions (DOM-free):
- `SW.layoutWall(w, h)` → `{L, pieces:[{kind:'seg'|'open'|'unsh', x0, x1, …}], assumed:true}`.
- `res.levels[k]` → `{k, name, h_ft, elevBot_ft, elevTop_ft}`.
- `res.stacks[id]` → `{id, label, top, bottom, levels, gaps, line, dir, loc_ft}`.
- `SW.planModel(state, res)` → extents, unlocated ids, per level lines/walls with coords, V, vmax, share, end T/C, pass, `sumV` vs `Vlevel`.
- Export `wallAt, wallPresence, layoutWall, planModel`; bump `ENGINE.rev`.
- Wall keys (optional): `start_ft`, editable `dir`, `loc_ft`. Top-level `state.plan = {B_ft, D_ft}` (add to `allowedKeys` `:1885`, `getModel/setModel`). Old files: absent → null.

## 2. Elevation view

- Wall selector (default first wall, remembered in localStorage, not the file).
- One story box per level top→base; solid where present, dashed ghost on gaps/levels above top; "shear collected, overturning stops" note when the wall ends above base.
- Per box: width L at that level, h; `layoutWall` pieces (segments filled, openings as voids `w × hc`, h/3 flag, `× 2b/h` tag, h/b > 3.5 hatch). Dimensions L, b_i, h.
- Loads: story increment arrow `rows[k].Pfac` (0.6·W / 0.7·E labelled; line share noted); cumulative V shear arrow + v_max at box base; dead UDL + P_end.
- Reactions per level: ⇄ direction toggle; → gives T at End 1 (`ends[0].T`), C at End 2 (`ends[1].C`); segmented per segment. Base: V, T, C, t, T_req per bolt, sill label.
- Case selector Governing / Wind / Seismic (default `gov.vmaxCase`).
- Scale-to-fit viewBox; fixed-px labels.

## 3. Plan view

- Level selector; building rectangle B × D (or wall bounding box + 10 %), N/S/E/W labels.
- X walls horizontal at y = loc, x = start…start+L; Y walls vertical. `start_ft` null → centred, dotted, listed as unlocated; no dir/loc → strip only.
- Labels: id, L, V, v_max, line force chip, share %, optional T/C markers (off by default), pass/fail colour.
- Σ wall V vs cumulative level force in the header.
- Click → select wall, switch elevation, scroll results row `#wres_fi_wi`. Position editor (dir, loc, start, B × D) in the plan panel.
- One direction per file (X+Y on one page still deferred, 2026-09-22 plan §F).

## 4. Dynamic, performance, print, theme

- `renderViews(res)` at the end of `renderResults()` `:1303-1337`; container `#swViews` between `#modelMsgs` and `#floor-con` (like `#diaImportHost`). Selector changes re-render from cached `res`.
- String-built SVG, one innerHTML per panel (real file: 75 panes in 79 ms today).
- Print 17 × 11: every level's plan + selected wall elevation; hide controls; `max-height` on SVG; add to `tools/test-sw-print.mjs`.
- Colours via page tokens `--are-*` on SVG classes; no dark scheme exists in are-theme-v2.

## 5. Phases and verification

**Phase 1 — engine.** `layoutWall`, `res.levels`, `res.stacks`, `planModel`, exports. Fixtures SW68–SW72: layout of CASE1 base wall; interleave + trailing unsheathed strip; level elevations + stack with start-above-base and transfer gap; planModel with located/unlocated walls and Σ = line V; statics identities on every fixture wall (Σ Pfac = V, Σ m = M, T·lever + 0.6·MR = M when T > 0, Cot·lever = M, segmented Σ V_i = V). Gate `npm run test:sw`, SW1–SW67 unchanged.

**Phase 2 — `engines/sw-views.js`.** `elevationSVG(res, state, opts)`, `planSVG(plan, k, opts)` → `{svg, warnings}`; every numeric label carries `data-q / data-v / data-k`, walls `data-wall`. `tools/test-sw-views.mjs` (`test:swviews`): element counts, every `data-v` equals engine within 0.05, finite viewBox, no NaN, plan wall count, Σ label.

**Phase 3 — page.** Script tag, `#swViews` block and controls, `renderViews`, `applyWallField` cases `dir/loc_ft/start_ft`, delegated click, CSS + print rules. Harness: base-level labels match existing asserted values (70.29 plf, 1806.8 lb); editing L re-renders; plan click changes elevation; 23 columns; qa roundtrip/adversarial; print PDF 1224 × 792.

**Phase 4 — handoff + E2E.** `toShearwallState` adds `plan: {B_ft, D_ft}`; adapter keys; `tools/e2e-sw-views.mjs` on the 26-038 Red Bluff file: 3 levels × 25 walls, X@15 base V 7,459.8 lb / Vstrength 12,433; set B × D 120 × 360 and start on X@15 → bar 0–20 ft; PDF page count; screenshots.

## 5a. Opening positions (Nick, 2026-09-30: add them)

- Syntax in the existing Openings box: `w×hc@x` — `x` = distance from End 1 to the opening's near edge, ft. `@x` optional; `8x7, 6x4@22` mixes. Model: `openings[i].x_ft` (number or absent). `parseOpenings` / `fmtOpenings` round-trip it; old files have no `x_ft` and load unchanged.
- Engine math unchanged: A_o, C_o, Σb_i, segmented shares do not depend on position. Position only drives `layoutWall` and new warnings.
- `layoutWall` when every opening has `x_ft`: openings placed exactly; the solid pieces between them are matched to `segments_ft` in order from End 1. `validate()` warnings (not errors): opening runs past L or overlaps another; solid piece narrower than its listed b_i (b_i does not fit); count of solid pieces ≠ segment count. Leftover solid length beyond b_i drawn as unsheathed.
- Partial positions: positioned openings placed, unpositioned ones fall back to the assumed order in the remaining gaps; drawing stamped "some opening positions assumed". None positioned: assumed order (seg 1, open 1, seg 2, …, remainder unsheathed at End 2), stamped "layout order assumed".
- Copy-down / line fan-out: `openings` already in `COPY_FIELDS` `:686` and per wall, so `x_ft` rides along with no extra work.
- Import: diaphragm walls have no openings, nothing to carry.
- Fixtures: add SW73 (positioned openings → exact pieces, matches segments), SW74 (overlap + b_i-does-not-fit warnings), SW75 (partial positions); parse/format round-trip in the page harness; Red Bluff E2E numbers must not move.

## 6. Decisions

Answered by Nick 2026-09-30:
1. **Segment/opening layout**: add opening positions (§5a), assumed order only as fallback.
2. **Position editing**: editor in the plan panel for the selected wall, no new table column.
3. **Load case**: one selector, default = case governing v_max; wind/seismic override.
4. **Print scope**: all plans + selected elevation only.

Carried with the recommendation (not asked):
5. **Drawing library**: string SVG in `sw-views.js`, not AREDraw (DOM-only).
6. **B × D storage**: top-level `state.plan`, filled by the diaphragm import.
7. **Reactions**: one load direction with ⇄ toggle; drawing states C excludes dead-load relief while T includes 0.6D, so ΣFy does not close on the picture — engine identities tested instead.
