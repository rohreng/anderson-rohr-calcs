# Plan — Stacked Shearwall: gypsum wallboard face 1 (SDPWS Table 4.3C) + blocked/unblocked

_2026-09-30. Fable-planned from SDPWS 2015; Claude verified against SDPWS 2021 with commentary (RE CODING/wood/721340051-...AWC-2021.pdf). Status: LOCKED — Nick answered D2–D6 (all recommendations) and widened scope to unblocked WSP, 5/8" two-ply and gypsum sheathing board. Builds after the level-force/sizing fixes commit._

## 2021 verification (Claude, PDF p. 50 = printed p. 42 for Table 4.3C)
- Table 4.3C 2021 gives a single nominal v_n; gypsum values identical to 2015 (1/2" 5d@7 24u 150 … 5/8" 6d@4 16b 350). §4.1.4.1 ASD = v_n/2.8 seismic, §4.1.4.2 v_n/2.0 wind. **D1 resolved: engine ÷2.8 / ÷2.0 on the tabulated v_n is exact 2021.** No `vs2021` slot needed.
- §4.3.2.3: perforated walls sheathed on one or both sides with WSP; WSP + gypsum opposite side per §4.3.5.4.2.
- Table 4.3.3 note 1: h/b > 1.5:1 must be blocked; note 2: wind, blocked WSP (or fiberboard) with gypsum opposite → gypsum h/b 3.5:1.
- §4.3.7.5: gypsum board shear walls for wind and seismic SDC A–D; staggered end joints, nails ≥ 3/8" from edges, 2" nominal framing.
- §4.3.5.3 / Table 4.3.5.3: unblocked WSP, C_ub, height ≤ 16 ft (deferred).
- C4.3.5.4.2: two-sided WSP + gypsum, seismic crediting 2× gypsum → lesser R (R = 2); WSP alone → R = 6.5.
- 2021 section map (2015 → 2021): unblocked WSP §4.3.3.2 → §4.3.5.3; aspect Table 4.3.4 → Table 4.3.3; combining §4.3.3.3 → §4.3.5.4; gypsum §4.3.7.5 unchanged; commentary C4.3.3.3.2 → C4.3.5.4.2. Use 2021 numbers in engine text, 2015 in parentheses as elsewhere.

## Fable plan (2015 citations; apply the 2021 map above)

### Rows (Table 4.3C, gypsum wallboard) — {id, type:'gyp', thickness, nail, spacing (edge), field, studs, blocked, vn}
| id | thk | fastener | edge/field | studs ≤ | blocked | vn |
|---|---|---|---|---|---|---|
| gyp12_5d_7_24u | 1/2 | 5d cooler / wallboard nail | 7 | 24 | no | 150 |
| gyp12_5d_4_24u | 1/2 | 5d cooler | 4 | 24 | no | 220 |
| gyp12_5d_7_16u | 1/2 | 5d cooler | 7 | 16 | no | 200 |
| gyp12_5d_4_16u | 1/2 | 5d cooler | 4 | 16 | no | 250 |
| gyp12_5d_7_16b | 1/2 | 5d cooler | 7 | 16 | yes | 250 |
| gyp12_5d_4_16b | 1/2 | 5d cooler | 4 | 16 | yes | 300 |
| gyp12_s6_8-12_16u | 1/2 | No. 6 screw 1-1/4 | 8/12 | 16 | no | 120 |
| gyp12_s6_4-16_16b | 1/2 | No. 6 screw | 4/16 | 16 | yes | 320 |
| gyp12_s6_4-12_24b | 1/2 | No. 6 screw | 4/12 | 24 | yes | 310 |
| gyp12_s6_8-12_16b | 1/2 | No. 6 screw | 8/12 | 16 | yes | 140 |
| gyp12_s6_6-12_16b | 1/2 | No. 6 screw | 6/12 | 16 | yes | 180 |
| gyp58_6d_7_24u | 5/8 | 6d cooler | 7 | 24 | no | 230 |
| gyp58_6d_4_24u | 5/8 | 6d cooler | 4 | 24 | no | 290 |
| gyp58_6d_7 (keep id) | 5/8 | 6d cooler | 7 | 16 | yes | 290 |
| gyp58_6d_4 (keep id) | 5/8 | 6d cooler | 4 | 16 | yes | 350 |
| gyp58_s6_8-12_16u | 5/8 | No. 6 screw | 8/12 | 16 | no | 140 |
| gyp58_s6_8-12_16b | 5/8 | No. 6 screw | 8/12 | 16 | yes | 180 |
Legacy rows first so old-file fallback lookups never change. WSP rows gain blocked:true, studs:24, field:null.

### Engine
1. findSheathing: id first; fallback type+thickness+nail+spacing AND blocked (absent → true) AND studs (absent → blocked 16") AND field (absent → null). Old {gyp,5/8,6d cooler,7|4} must still resolve to 290/350.
2. sheathingLabel carries studs, blocked, screw edge/field.
3. normalizeWall: sheathing.blocked absent → true.
4. validate(): gypsum face 1 + perforated → error (§4.3.2.3, use segmented); gypsum face 1 + A.15/B.22 → error (A.17/B.24 required, C4.3.5.4.2); gypsum face 1 in SDC E/F → error (§4.3.7.5); gypsum face 1 + WSP face 2 → error (put WSP on face 1); row.blocked ≠ wall blocked → error; WSP + unblocked → error (unblocked WSP §4.3.5.3 not modelled); gypsum face 1 segment h/b > 2.0 blocked / 1.5 unblocked → error (Table 4.3.3 + note 1); line walls must share face-1 type.
5. Face-2 gate: unblocked gypsum 1.5 both cases; blocked unchanged (2.0 seismic / 3.5 wind note 2).
6. combineFaces: numbers unchanged; refs updated.
7. (D6) Seismic under A.15/B.22 with gypsum face 2: credit WSP face only (C4.3.5.4.2). CHANGES EXISTING RESULTS for WSP+gyp walls.
8. Table 4.3A fn. 6 "both faces < 6" and 2"/10d/980 triggers WSP faces only; gypsum §4.3.7.5 construction note.
9. compute(): warning when SFRS is A.17/B.24 and every face 1 is WSP (conservative R); notes line for gypsum walls; ENGINE.rev bump.

### Page
- Face 1 header "Face 1"; blocked select inside the Face 1 cell (keeps 23 columns); shOpts optgroups Table 4.3A / Table 4.3C filtered by blocked, selected row always listed; LINE_FIELDS + blocked; applyWallField 'blocked'; faceFromId keeps id + new fields; ref table + notes updated.

### Fixtures G1–G10 (hand values)
G1 1/2" 5d@7 24u segmented [8,8] h 8 P 1000, B.24: v 62.5, wind ASD 75.0 D/C 0.833, seismic ASD 53.57 D/C 1.167, T_i 500 lb. G2 aspect 1.5/2.0 refusals. G3 perforated gypsum refused. G4 SFRS mismatch error / B.24-all-WSP warning. G5 SDC E errors. G6 blocked mismatch + unblocked WSP refusal. G7 old-file resolution 290/350, SW17/SW43 unchanged. G8 two gypsum faces 600 / 500. G9 A.15 WSP+gyp seismic 670 wind 1020; B.24 seismic 700. G10 fn. 6 trigger WSP-only.

## Decisions for Nick
- D2 gypsum face 1 under A.15/B.22: error (rec).
- D3 blocked control in the Face 1 cell (rec) vs new column.
- D4 5/8" two-ply (500) + gypsum sheathing board rows: defer (rec).
- D5 unblocked WSP (C_ub): defer, refuse with citation (rec).
- D6 WSP + gypsum face 2 under A.15/B.22 seismic: credit WSP only per C4.3.5.4.2 (rec) — changes existing seismic results on such walls.

## Nick's answers (2026-09-30) — LOCKED
- D2 error; D3 blocked select in the Face 1 cell; D6 credit WSP only for seismic under A.15/B.22 (wind still sums).
- D4/D5 widened: ADD unblocked WSP, 5/8" two-ply gypsum, gypsum sheathing board.

## Added scope (2021 values, PDF p. 39-40 / 50)
**Extra Table 4.3C rows**
| id | material | fastener | edge/field | studs ≤ | blocked | vn |
|---|---|---|---|---|---|---|
| gyp58x2_6d8d_16b | 5/8" two-ply wallboard | base ply 6d cooler @9, face ply 8d cooler @7 | 9 / 7 | 16 | yes | 500 |
| gsb12_2x8_4_16u | 1/2" x 2'x8' gypsum sheathing board | 0.120" x 1-3/4" galv. diamond-point | 4 | 16 | no | 150 |
| gsb12_4_4_24b | 1/2" x 4' gypsum sheathing board | same | 4 | 24 | yes | 350 |
| gsb12_4_7_16u | 1/2" x 4' gypsum sheathing board | same | 7 | 16 | no | 200 |
| gsb58_4_47_16b | 5/8" x 4' gypsum sheathing board | 6d galv. cooler | 4/7 | 16 | yes | 400 |
All type 'gyp' for the system rules (§4.3.7.5 covers wallboard and sheathing board; 4.3.7.5.2 construction note for sheathing board: 4-ft pieces, long dimension parallel to studs where used as blocked 4-ft rows — builder reads 4.3.7.5.2 text and prints the note).

**Unblocked WSP — SDPWS 2021 §4.3.5.3, Eq. 4.3-2, Table 4.3.5.3**
- v_n(ub) = v_n(b) · C_ub, v_n(b) = Table 4.3A blocked value with 24" studs and 6" edge nailing (the engine's @6 row for that panel/nail).
- Unblocked WSP allowed only with edge spacing 6; new wall inputs (line fields, shown only when unblocked WSP): stud spacing 12/16/20/24 (default 16) and intermediate framing nailing 6/12 (default 12).
- C_ub: edge 6 / field 6 → 1.0, 0.8, 0.6, 0.5 at studs 12/16/20/24; edge 6 / field 12 → 0.8, 0.6, 0.5, 0.4.
- Height ≤ 16 ft (error). Aspect ratio 2:1 (Table 4.3.3; segmented error above 2.0; perforated segments above 2:1 per §4.3.3.4 — builder confirms how unblocked interacts with the 2b/h rule, keep Table 4.3.3 limit 2:1 as the refusal).
- Two faces unblocked WSP: same construction both sides → 2× (§4.3.5.4.1).
- Replaces "WSP + unblocked → error" in the engine list with this model; keep the error for edge spacing ≠ 6 or height > 16.

**Fixtures to add:** U1 7/16" 8d unblocked, studs 16, field 12: v_n = 670 × 0.6 = 402 plf, wind ASD 201, seismic ASD 143.6; U2 h 17 ft refused; U3 edge 4 unblocked refused; U4 segmented h/b 2.5 unblocked refused; T1 two-ply 500 row resolves and computes; S1 gypsum sheathing board 5/8 400 row.

## Addendum — Fable revised plan (2021-verified), merged
- Blocking is per face in 2021 (§4.3.5.4: blocked one side, unblocked other → §4.3.5.4.2). Keep Nick's D3: a Blocked/Unblocked select in the Face 1 cell sets face 1's blocking (w.sheathing.blocked = face 1). Face 2 select lists optgroups "Table 4.3A WSP — blocked", "WSP — unblocked (C_ub)", "Table 4.3C gypsum — blocked", "— unblocked"; each face's rules read its row's `blocked`. Blocked + unblocked pair → max(2×smaller, larger) (§4.3.5.4.2), wind WSP+gyp exception unchanged.
- Unblocked WSP stud spacing + intermediate nailing are wall (line) inputs shared by both faces; shown when either face is unblocked WSP.
- G10: unblocked gypsum face 2 on a WSP wall with segs [4] (h/b 2.5) is dropped for wind too (limit 1.5) → 670/670; blocked gyp row → 960/670.
- G11: Table 4.3A fn. 6 "both faces < 6" fires only for two WSP faces.
- Close out docs/stacked-wood-qaqc-2026-09/F-edition-deltas.md l. 52/66 and D-shearwall-recompute.md l. 288-291 with the 2021 Table 4.3C citation (PDF p. 50): single v_n, ÷2.8 seismic exact.
- 2021 page refs: §4.1.4 p. 24; §4.3.2.3 p. 38; Table 4.3.3 p. 39; §4.3.5.3/Table 4.3.5.3 p. 40; §4.3.5.4 pp. 40-41; §4.3.5.5 p. 41; §4.3.7.1 p. 44-45; §4.3.7.5 p. 46; Table 4.3A p. 48; Table 4.3C p. 50; C4.3.5.3 / C4.3.5.4.2 p. 113.
