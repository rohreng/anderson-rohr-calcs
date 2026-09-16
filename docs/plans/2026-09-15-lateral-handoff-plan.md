# Plan: MWFRS → Diaphragm → Stacked Shearwall lateral handoff

_Prepared 2026-09-15 for Nick. Implementation-ready. Every claim below was read from the code or run against Nick's 26-038-HNR files; `file:line` refs are to the repo as of commit `74cb653`._

## Summary

Nick's workflow is MWFRS (all story forces) → one Diaphragm Designer file per level (same B/D and wall layout, that level's force) → one Stacked Shearwall file per wind direction (every level, every wall line, that line's reaction). Today only the first hop works, and only one level at a time; the MWFRS → Stacked Shearwall button opens a page that ignores its URL (dead); and the Stacked Shearwall engine takes one force per floor, not per wall line.

Recommendation, in shippable order:

0. **Fix diaphragm persistence** (latent defect found while testing — Nick's ROOF LEVEL file already trips the "does not match" dialog on reload). Row inputs become `data-are-ignore`; `#swJSON` is the single carrier; a page-local `loadFromState` shim normalizes old files silently.
1. **Engine: optional per-wall `P_wind_lb` / `P_seis_lb` override** on the wall object, falling back to the floor value. `storyForces()` gains a `wallId` argument. Adapter stays version 2 (no bump — `allowedKeys` is top-level only, verified at `are-utils-v2.js:1453`).
2. **Extract `calcDir` into `engines/rect-diaphragm.js`** (pure function move) and add **`engines/lateral-handoff.js`**: a DOM-free builder/parser for a versioned `are.lateral.v1` record, node-tested with Red Bluff fixtures.
3. **MWFRS sends all levels** (story table + both directions + geometry) in one payload; the Diaphragm Designer gains a level selector that swaps `#level`/`#Vx`/`#Vy` while keeping geometry, persists the payload in its own snapshot so it survives weeks/profiles, and declares its load level explicitly. The dead MWFRS → Stacked Shearwall block is removed.
4. **Stacked Shearwall imports N saved diaphragm `.html` files** (multi-file picker → `AREv2.parseSnapshot` → `LH` → `SW` state), one direction per import, wall lines matched across levels by **location**, typical lines optionally merged, plus a single-level quick path from the Diaphragm Designer.

Transport is **files, not localStorage**: each diaphragm snapshot is self-describing (geometry, layout, level force, story table, load level), so the stacked shearwall can be built from files saved on different days or browsers. localStorage is used only for the immediate MWFRS → Diaphragm send (existing house pattern, 10-minute TTL) and is redundant with the persisted payload.

---

## Findings (verified in code)

### F1. MWFRS → Diaphragm: one level per send, first two rows overwritten
- `asce716_mwfrs_calculator.html:1198-1211` `doSendDiaphragm()` opens `rectangular_diaphragm_calculator.html?src=mwfrs&vx=<F_net>&vy=<F_net>&B&D&story=<label>` — one level, force in **lb, strength level** (`F_net` = `p_net × trib_h × Bperp`, `:708-709`, plus parapet at rows[0], `:765-773`).
- Two independent level selects `#diaStoryX` / `#diaStoryY` (`:1149-1153`) let X and Y be sent from different levels — meaningless; only `rx.label` reaches `?story=`.
- Diaphragm URL import (`rectangular_diaphragm_calculator.html:962-1010`) sets `#Vx = vx/1000` (kips), `#B`, `#D`, `#level`, then **overwrites the first two shearwall rows' `len`/`loc`** from B/D (`:981-995`). With Nick's 25 + 5 line layout this is wrong on every re-send.

### F2. MWFRS → Stacked Shearwall: dead
- `asce716_mwfrs_calculator.html:1186-1196` `doSendShear()` opens `stacked_shearwall_calculator.html?lateral=<V_cum>&src=mwfrs&dir=Wind-X&story=…`.
- `stacked_shearwall_calculator.html` reads exactly one query param: `selftest` (`:1022`). Nothing consumes `lateral`/`src`/`dir`/`story`. Confirms Nick's complaint.

### F3. Diaphragm Designer model and persistence (Tier A, `adapterVersion: 0`)
- Inputs: `#level` text (`:107`), `#B`/`#D` (`:125-126`), `#Vx`/`#Vy` kips (`:139,143`), `#Vx_s`/`#Vy_s` "Seismic / Other" kips (`:149,153`). **No load-level field.** Page text says "Enter the diaphragm-level force (not cumulative)" — nothing about strength vs ASD.
- Wall rows: `.sw-row` under `#swX` / `#swY`, inputs `#sw{X|Y}_{label|len|loc}_{n}` with `n` from `swIdCounter` (`:284`, monotonically increasing, **not** re-indexed on delete). Hidden `#swJSON` mirrors `{X:[{label,len,loc}],Y:[…]}` on every `updateDiagram()` (`:325-330`, called `:372,521`). Both the per-row inputs **and** `#swJSON` are captured by Tier-A save; on load the `#swJSON` change handler rebuilds rows 0..n-1 (`:1112-1122`).
- **Latent defect (reproduced headlessly with Nick's file):** the ROOF LEVEL snapshot carries `#swX_*_25` but no `#swX_*_24` (a row was deleted then re-added). On load, `#swJSON` rebuilds rows 0..24, so `#swX_*_25` → `missingOnPage` and `#swX_*_24` → `notInFile`; `AREv2.loadFromState` rolls back and the toolbar shows "This file does not match the calculator as it stands today … Load it anyway?" (`are-utils-v2.js:1586-1607, 1865-1872`). Load-anyway then works because `#swJSON` is authoritative. Fix in Phase 0.
- `calcDir()` (`:644-745`) is already pure: `(V, L_along, B_perp, swRows, dirLabel) → {sws (sorted by loc), reactions[], unitShears[], M_max, chord_T, v_dia, …}`. **Reactions are indexed on the loc-sorted `sws`, not input order** (`:651-652`).
- Multi-line distribution is tributary (`:668-676`); 2 lines is a statically determinate beam; 1 line takes all.
- Legacy `saveInputsDia`/`loadInputsDia` JSON (`:1012-1091`) and `localStorage.ARE_diaphragm` (gov shears only, masonry send, `:946-955`) are untouched by this plan.

### F4. Stacked Shearwall model and engine
- `SW.defaultState()` (`engines/stacked-shearwall.js:754-777`): `{version:2, sfrs, sdc, species, floors:[{id, name, h_ft, P_wind_lb, P_seis_lb, walls:[…]}]}` top → bottom. Wall: `{id, label, L_ft, h_ft, segments_ft[], openings[], unsheathed_ft2, sheathing, endPost, holdown, sill, sillSpecies, dead, uplift, transfer}` (`:742-753`).
- **Force is per floor.** `storyForces(floors, caseKey, present)` (`:207-224`) reads `floors[j].P_wind_lb` for every `j ≤ k` where `present(j)`; `computeWall` calls it per wall with `wallPresence(floors, w.id)` (`:559-563, 472-479`). Every wall on a floor therefore receives the whole floor force.
- `P_wind_lb` is **strength level**; engine applies `LOAD.wind.factor = 0.6`, `LOAD.seismic.factor = 0.7` (`:203-205`, page text `:280-282, 326`). Fixtures drive ASD values through `P/0.6` (`:779-802`).
- Walls correlate across levels by `id` (continuity check `:339-363`; a gap is an error unless the wall below declares `transfer:true`).
- `addFloor()` inserts at the **top** and clones the top floor's walls (`stacked_shearwall_calculator.html:415-420`).
- AREv2 adapter (`:1040-1080`): `version: 2`, `ownedFields ['#floor-con']`, `schema.allowedKeys ['version','floors','wCnt']`, `maxStringLength 120`, `stringPattern` denies `<`, `>`, control chars. **`allowedKeys` is enforced at depth 0 only** (`are-utils-v2.js:1453`), so new keys on floor/wall objects need no schema change; new top-level keys do.
- `AREv2.loadFromState` **hard-refuses** `state.adapterVersion !== adapter.version` (`are-utils-v2.js:1501-1505`). Bumping the adapter version would orphan every saved shearwall file. Do not bump.
- Test `tools/test-stacked-shearwall.mjs` (`npm run test:sw`): Playwright headless Chromium, every request fulfilled from `public/` on disk, runs `window.SW.runFixtures()` (fixtures live inside the engine, `:806-1178`), then DOM/adapter/print checks. The engine also `module.exports` (`:1210`) so pure-node tests are possible.

### F5. AREv2 facts the plan relies on
- Tier-A capture: every `input/select/textarea` not `data-are-ignore`, not toolbar, not adapter-owned (`are-utils-v2.js:846-862`); hidden inputs are captured; key = `#id` (`:882-883`).
- Reverse diff: any persistable field on the page but absent from the file → `notInFile` → rollback + confirm (`:1586-1607`). A calc can pre-normalize a parsed state by wrapping `AREv2.loadFromState` — precedent `stacked_headers_studs_calculator.html:1441-1462`.
- Save runs the calc first (`runAndSettle()` at `:1258, 1281`) so hidden JSON carriers written in `calculate()`/`updateDiagram()` are current at capture.
- `AREv2.parseSnapshot(html)` is public (`:1465-1473`) and only needs `DOMParser` — usable from the shearwall page to read diaphragm files. `loadFromState` refuses a foreign `calcFile` (`:1486-1490`), so the shearwall page must parse, not load.
- `AREv2.snapshotName({project,title,mark})` → `"<project> - <title stem> - <mark> - <date>"`, 90-char cap (`:1195-1215`). Nick's files: `26-038-HNR - Red Bluff Hotel - Rectangular Diaphragm Designer - ROOF LEVEL - 2026-09-15.html`. **Mark is what distinguishes levels.**
- Existing cross-calc transfer: `localStorage['are_transfer_v1']` `{file, fields:[{id,value}], ts}` applied at init with a 10-minute TTL (`:436-476`). `sendTo` is private.
- `areLoad` picker is `multiple:false` (`:1900`); the shearwall import needs its own picker.
- The calc runs inside an iframe shell at `/calcs/<slug>` (`app/(main)/calcs/[slug]/page.tsx:33-47`); `window.open(base + file)` from inside the iframe opens the bare `/Calcs/*.html` in a new tab, same origin — localStorage is shared.

### F6. Nick's Red Bluff numbers (26-038-HNR, run headlessly from his two snapshots)
MWFRS (`… ASCE 7-16 MWFRS Wind - 26-038-HNR - 2026-09-15.html`): V=115, Exp B, enclosed, Kzt 1.00, Ke 0.984, **B=120 ft (EW), D=360 ft (NS), h=35.5 ft, hp=4.5 ft**, flat roof. Stories (top→bottom, `sh` = floor-to-floor of the story whose top is that diaphragm): **Roof 11 ft, 3RD 10.5 ft, 2ND 14 ft.**

| Level | h (ft) | trib_h | Wind-X F_net (lb) | of which parapet | Wind-X V_cum | Wind-Y F_net (lb) | of which parapet | Wind-Y V_cum |
|---|---|---|---|---|---|---|---|---|
| Roof | 11 | 5.5 | **131,315** | 87,160 | 131,315 | **40,861** | 29,053 | 40,861 |
| 3RD | 10.5 | 10.75 | **79,782** | 0 | 211,098 | **20,904** | 0 | 61,765 |
| 2ND | 14 | 12.25 | **87,306** | 0 | 298,403 | **22,618** | 0 | 84,383 |

Diaphragm ROOF LEVEL (`… Rectangular Diaphragm Designer - ROOF LEVEL - 2026-09-15.html`): `#level` "Roof", B=120, D=360, **Vx = 131.31 k, Vy = 40.86 k** (the URL send rounded to 10 lb). Layout: **X (EW walls resisting Wind-X): A1…A25, each 20 ft, loc 0,15,…,360 ft from S (25 lines)**; **Y (NS walls resisting Wind-Y): AA 280 ft @ 0, AC 160 @ 30, BB 120 @ 60, DB 360 @ 90, BD 360 @ 120 ft from W (5 lines).**

Computed reactions at the roof (tributary, strength level because Vx came from MWFRS unmodified):

| Dir | Line | L (ft) | loc | R (lb) | v (plf) |
|---|---|---|---|---|---|
| X | A1, A25 (ends) | 20 | 0 / 360 | **2,736** | 137 |
| X | A2…A24 (23 typ.) | 20 | 15…345 | **5,471** | 274 |
| Y | AA | 280 | 0 | **5,107** | 18 |
| Y | AC | 160 | 30 | **10,215** | 64 |
| Y | BB | 120 | 60 | **10,215** | 85 |
| Y | DB | 360 | 90 | **10,215** | 28 |
| Y | BD | 360 | 120 | **5,107** | 14 |

Σ R over X lines = 2×2,736 + 23×5,471 = 131,305 lb ≈ F_net 131,315 (rounding) — the builder invariant. With the same layout at 3RD/2ND: X interior 3,324 / 3,638 lb, X ends 1,662 / 1,819 lb; Y AA & BD 2,613 / 2,827 lb, Y AC/BB/DB 5,226 / 5,655 lb.

### F7. Load level — the contract
MWFRS pressures are ASCE 7-16 strength (W). `F_net` is strength. `doSendDiaphragm` sends it unmodified. The Diaphragm Designer reports plf with no load-level tag. The Stacked Shearwall takes strength and applies 0.6W / 0.7E. Therefore: **a diaphragm reaction derived from a MWFRS send is strength level and passes straight into `P_wind_lb`.** The only way to get this wrong is a Vx typed by hand at ASD — hence Phase 3 adds an explicit `#loadLevel` declaration, defaulted to `strength`, forced to `strength` on any MWFRS import, and converted (÷0.6 wind, ÷0.7 seismic) by the builder when set to `asd`. `#Vx_s`/`#Vy_s` "Seismic / Other" are treated as E (0.7 factor) — open question Q1.

### F8. Side observations (out of scope, noted only)
- `reindexStories()` (`asce716_mwfrs_calculator.html:562-570`) rewrites every story label to `Roof`/`Floor n` on any add/remove — Nick's `3RD`/`2ND` labels would be clobbered if he added a story later.
- The MWFRS harness (`tools/test-mwfrs-wind.mjs`) has a baseline fixture; nothing in this plan changes MWFRS numbers, only the send panel, so the baseline stays valid.

---

## Decisions

### A. Multi-level diaphragm workflow

Options:
- (i) MWFRS sends **all levels** in one payload; the Diaphragm Designer gains a **level selector** that swaps `#level`/`#Vx`/`#Vy` and leaves geometry alone. Payload is persisted inside the diaphragm snapshot.
- (ii) "Copy to next level" button opening a new tab with geometry preserved and the next level's force pulled from a stored payload.
- (iii) Diaphragm Designer becomes natively multi-level (one file, N levels).

**Recommend (i), with (ii) reduced to a "Next level ↓" button that advances the selector in place.** Rationale: (i) is the smallest change that gives Nick exactly what he asked for (same geometry, that level's force) and keeps his filing convention — one snapshot per level, distinguished by Mark. (iii) would rewrite a Tier-A calc into a Tier-B model, change every saved diaphragm file's shape, and change how he files; the per-direction stacked shearwall file already is the "all levels in one place" artifact, so a multi-level diaphragm buys nothing he needs. New tabs (ii) add nothing over in-place switching except tab clutter; the one real risk of in-place switching — saving 3RD over the ROOF file because Mark still says "ROOF LEVEL" — is handled by the Mark rule below.

Specifics:
- MWFRS `doSendDiaphragm()` writes the full `are.lateral.v1` record (all levels, both directions, B, D, h, story heights, project, `loadLevel:'strength'`) to `localStorage['are_lateral_v1']` with `ts`, then opens `rectangular_diaphragm_calculator.html?src=mwfrs&lat=1&story=<label>&vx&vy&B&D` (legacy params kept as fallback for a missing/expired key). One start-level select `#diaStory` (data-are-ignore) replaces the `#diaStoryX`/`#diaStoryY` pair.
- Diaphragm import IIFE: if `lat=1`, the key parses, `x.file === 'rectangular_diaphragm_calculator.html'` and `Date.now()-ts < 10 min` → `localStorage.removeItem` first (mirror `applyTransferIfAny`, `are-utils-v2.js:459-464`), then the cross-project guard (Review integration #3), then store the JSON string into hidden `#mwfrsJSON` (persisted, Tier A), set `#loadLevel = strength`, build `<select id="mwfrsLevel" data-are-ignore>` from `levels[].label`, select `story`, apply that level's `#level`/`#Vx`/`#Vy` (kips, 2 dp), set `#B`/`#D` only if the page still has defaults (60/120) — **never touch wall rows** (removes F1's overwrite). Else fall back to today's single-level behaviour minus the row overwrite.
- Level switch (`applyMwfrsLevel(idx)`): sets `#level`, `#Vx`, `#Vy`; leaves `#Vx_s`/`#Vy_s`, B/D, rows. Mark rule: if `#areMark` is blank, equals the previous level's label, or does not case-insensitively contain the new label, set it to the new label and toast "Mark set to 3RD" (Nick's ROOF file has Mark "ROOF LEVEL" with `#level` "Roof" — a blank-or-equals rule would never fire there and 3RD would be saved under the ROOF name). A Mark that already contains the label ("3RD LEVEL") is left alone. `#projName` set from payload if blank.
- `?story=`/`#level`: `#level` stays the free-text field that names the level in the snapshot and is the key the shearwall importer uses to place the file in the story order (case-insensitive trim match against `#mwfrsJSON.levels[].label`).
- Snapshot filenames: unchanged mechanism; Nick ends up with `… - Rectangular Diaphragm Designer - ROOF LEVEL - <date>.html`, `… - 3RD - <date>.html`, `… - 2ND - <date>.html` in `03 - Lateral`.
- Opening a saved level file later rebuilds the level select from `#mwfrsJSON` (via `AREv2.onAfterRestore` and the `#mwfrsJSON` change handler), so "Next level ↓" works next week in another browser with no MWFRS tab open.

### B. Diaphragm → Stacked Shearwall handoff: contract and transport

**Contract:** one versioned JSON, `schema: "are.lateral.v1"`, units in the field names, load level explicit, levels top → bottom, walls keyed by direction + location. Full example in the Data contract section. The same schema serves the MWFRS stage (levels without `walls`) and the diaphragm stage (levels with `walls`), so there is one parser.

**Transport options evaluated:**
| Option | Verdict |
|---|---|
| URL params | Too small for N levels × 30 walls; also the shearwall page cannot round-trip it. Kept only as the legacy single-level fallback for MWFRS → diaphragm. |
| `localStorage` registry keyed by project | Rejected as the system of record: silently empty in another profile/machine, after a cache clear, or next week; Nick would not know levels were missing until the stacked file looked wrong. |
| `sessionStorage` / `BroadcastChannel` / `postMessage` | Same-tab or live-tab only; the roof is done today and the floors next week. Rejected. |
| **Multi-file import of saved diaphragm snapshot `.html` files** (parse `<script id="are-state">` via `AREv2.parseSnapshot`) | **Recommended.** The files are already the artifact Nick files per level; they never expire; the record is exactly what was designed and printed. Each snapshot carries geometry, layout, level force, story table, load level and project, so the stacked model is fully derivable with no hidden state. |
| Single-level quick send (diaphragm → shearwall via `localStorage['are_lateral_v1']`) | Phase 4b — built only if Nick answers Q3 yes. Same builder, one level. |

**Recompute, do not copy, reactions.** The importer derives reactions from the snapshot's inputs through the shared `RD.calcDir` (Phase 2) rather than reading rendered numbers, so a stale or hand-edited results block cannot leak in, and the node test can assert numbers without a browser.

**Level ordering** comes from the embedded story table (`#mwfrsJSON.levels[]` order; each file's `#level` must match a label). `LH.assemble` takes the first story table found in **any** file and places every file by its `#level` against it. Picker-order fallback applies only when **no** file carries a table; that fallback order, and the editable `h (ft)` per level (Review integration #2), live in the inline import panel — never in `confirm()`, which the harness dismisses (`test-stacked-shearwall.mjs:28`). The practical path for Nick is to re-send from MWFRS once (Phase 3) so every level file carries the table.

**Validation at assembly:** same `B`/`D` across files (error), same project (warning), duplicate level labels (error), blank `#level` (error), duplicate `loc` within a direction inside one file (error — same rule as the page's `checkSwLocs`), a level in the story table with no file (warning: "3RD not imported — story shear below it will be short"), `loadLevel` present (else assume `strength` with a warning), wall present at a lower level but not above → fine (starts lower), wall present above and missing below → engine's existing continuity error unless `transfer` is set (surfaced by `SW.validate`).

### C. Per-wall force in the Stacked Shearwall engine

Options:
- (a) Optional per-wall `P_wind_lb` / `P_seis_lb` override on the wall object; floor value remains the fallback.
- (b) One stacked-shearwall file per wall line (Red Bluff: 25 + 5 = 30 files). Unusable.
- (c) One file per direction with per-wall forces — this is the *output shape* and requires (a).

**Recommend (a) + (c).** Engine change is ~12 lines and additive:
- `storyForces(floors, caseKey, present, wallId)` — when `wallId != null`, `P` at level `j` = `wallAt(floors, j, wallId).P_wind_lb` (or `P_seis_lb`) if that value is a finite number, else `floors[j].P_wind_lb`. Rows gain `src: 'wall' | 'level'` so the detail HTML can say which was used. `present(j)` semantics unchanged: a wall absent at `j` contributes nothing at `j` (the diaphragm at `j` did not load it).
- `computeWall` passes `w.id` (`:559-563`).
- `validate`: per-wall override, when present and not `null`/`''`, must be a finite number ≥ 0 (error text mirrors `:371`).
- Wall key names match the floor keys (`P_wind_lb`, `P_seis_lb`, strength level) so a reader sees one convention inside the model; the **contract** uses `_strength_lb` names at the boundary. `null` or absent = inherit — reserved for hand-added walls. `LH.toShearwallState` (and `updateForces`) always write **numeric** `P_wind_lb` **and** `P_seis_lb` (0 when the level has no seismic), so an imported wall never silently inherits the level total.
- Page: two new wall-table columns `P_W (lb)` / `P_E (lb)` (placeholder "= level"), `thc('pw_lb',70,…)`, `thc('pe_lb',70,…)`; `updWall` cases `'P_wind_lb'`/`'P_seis_lb'` (blank → `null`); the results-row `colspan` goes 20 → 22 (`:647`). Floor-header `P_W`/`P_E` inputs stay as the fallback and get a hint "used by walls with no line force".
- Detail HTML (`:863`) appends "(wall line)" when `rr.src === 'wall'`.

**Wall identity across levels: by direction + location, not label.** `id = dir + '@' + loc` with `loc` rounded to 0.1 ft (e.g. `X@15`, `Y@90`). A wall line at 45 ft from the south wall is the same stacked line on every floor — that is what "stacked" means physically; labels are display only and are exactly what the headers QAQC found fragile. Duplicate locations within a direction are already rejected by the diaphragm calc (`checkSwLocs`, `:841-853`). Match tolerance 0.5 ft (a 45 vs 45.3 ft entry is one line; 45 vs 60 is not).

**Typical-line merge (import option, default on):** wall lines in the same direction are collapsed into one row when, for **every** level, both are present or both are absent, `|ΔL_ft| ≤ 0.01`, and `|ΔR| ≤ max(1 lb, 0.1 % of R)` for wind and seismic; with `label = "A2–A24 (23 typ.)"`, `id` of the first member, and `typ: {count: 23, members: ['A2', …]}` on the wall (extra wall keys are legal). Lossless when the condition holds; the count is shown in the label and the calc record. Red Bluff X: 25 rows → 2 rows per floor.

### D. The dead MWFRS → Stacked Shearwall button

**Remove it.** Delete `doSendShear()`, `updateSendPreview()`, the `#sendDir`/`#sendStory` block and `window.updateSendPreview` export (`asce716_mwfrs_calculator.html:1115-1140, 1166-1196, 1870`). Retitle the panel "Send all levels to Diaphragm Designer". Rationale: Nick states the correct workflow is diaphragm → shearwall; a MWFRS-direct path can only deliver a floor total, which is wrong for any building with more than one wall line per direction (all of them), and repointing it at the new import would still bypass the diaphragm distribution. The `V_cum` column stays in the results table for reference. The adapter comment at `:1910-1913` is updated to name the surviving `#diaStory` select.

### E. Backwards compatibility

| Calc | Adapter | Change | Why old files still load |
|---|---|---|---|
| MWFRS | v1, `allowedKeys ['stories']` | **None** to the model. Payload is built at send time from `window.__mwfrsLast` + `#storyRows`. Removed selects were `data-are-ignore` (never captured). | Snapshot shape unchanged; `shapeHash` unchanged (ignored controls are not hashed). |
| Diaphragm | Tier A (`adapterVersion 0`) — **stays Tier A** | Per-row inputs get `data-are-ignore`; new persisted fields `#loadLevel` (select) and `#mwfrsJSON` (hidden). Page-local shim wrapping `AREv2.loadFromState` (pattern `stacked_headers_studs_calculator.html:1447-1463`): for `calcFile === 'rectangular_diaphragm_calculator.html'`, delete every `#swX_*`/`#swY_*` key from `state.fields`, default `#loadLevel = 'strength'` and `#mwfrsJSON = ''` when absent and the element exists on the page. | Old file keys that no longer exist are stripped before the diff (no `missingOnPage`); new page fields are supplied with defaults (no `notInFile`). Nick's ROOF file goes from "does not match … Load it anyway?" to a clean load. `shapeHash` differs → a notice in the toast only. Moving to a Tier-B adapter was rejected: `adapterVersion 0 → 1` is a hard refusal at `are-utils-v2.js:1501` and would need a heavier shim for no gain. |
| Stacked Shearwall | v2, `allowedKeys ['version','floors','wCnt']` | **Version stays 2.** Wall objects gain optional `P_wind_lb`, `P_seis_lb`, `loc_ft`, `dir`, `typ` (depth > 0, not whitelisted — verified `:1453`). One new top-level key `lateral` (import provenance: `{schema, project, files[], importedAt, dir}`) → `allowedKeys` becomes `['version','floors','wCnt','lateral']`. `getModel` returns `lateral: state.lateral || null`; `setModel` assigns `state.lateral = m.lateral || null`; wall overrides are not defaulted (absent = inherit). The schema's `maxStringLength 120` and `stringPattern` apply to every new string (file names in `lateral.files`, merged labels, `typ.members`), so file names are stored as basenames and truncated to 120. `docs/calc-state-spec.md §9` row updated. | Old files have no new keys; engine treats absent overrides as inherit; the fixtures (`SW.runFixtures`) prove the default-model numbers are unchanged. `allowedKeys` is a whitelist, not a required list, so old files without `lateral` pass. |

`exportProject()`/`importProject()` JSON (`:956-987`) carry `state` wholesale — no change needed.

### F. Tests

Node (`npm run test:lat`, new `tools/test-lateral-handoff.mjs`, **no browser**): `require` the three engines and run against fixtures in `fixtures/lateral/red-bluff/`:
- `mwfrs-state.json` — the `are-state` JSON from Nick's MWFRS file, numbers only: `project`, `mark`, `#projName`, `#projEng` blanked.
- `diaphragm-roof-state.json` — the `are-state` JSON from Nick's ROOF file (same blanking; pre-Phase-3 shape: no `#mwfrsJSON`, gapped row ids).
- `diaphragm-3rd-state.json`, `diaphragm-2nd-state.json` — synthesized: same fields with `#level`, `#Vx`, `#Vy` from the table in F6 and `#mwfrsJSON` filled with the Red Bluff `are.lateral.v1` record.
- `expected.json` — reactions table from F6.

Assertions: parser accepts the ROOF file and normalizes gapped row ids; reactions match F6 to ±1 lb; Σ R per level = F_net within 0.1 %; ordering follows the story table; `toShearwallState` yields 3 floors × (2 merged X rows | 25 unmerged) with `h_ft` 11/10.5/14; merged case: Σ `P_wind_lb × typ.count` per floor = 131,315 / 79,782 / 87,306 within 0.1 %; `SW.validate` ok; base-level `cases.wind.Vstrength` for `X@15` = 5,471+3,324+3,638 = 12,433 lb and `V` = 7,460 lb (0.6W); `asd` load level converts ÷0.6/÷0.7; B/D mismatch across files is an error; missing level is a warning; wall present at 3RD only starts there (no continuity error); label-only differences do not split a line (loc match); merge negative: two lines identical at Roof and 3RD but one absent at 2ND → not merged; mixed story tables: ROOF file without `#mwfrsJSON` + 3RD/2ND files with it → the table from 3RD orders all three by `#level`.

Engine (`npm run test:sw`, existing Playwright harness — add fixtures inside `SW.FIXTURES`): `SW9` two walls on one floor with different overrides → each wall's `Vstrength` equals its own Σ; `SW10` override at the roof, inherit at the base → mixed sum; `SW11` override on a wall absent at the middle level with `transfer:true` below → only present levels sum; `SW12` override `'abc'` → validate error; plus the existing default-model numbers unchanged (already asserted at `test-stacked-shearwall.mjs:77-85`, values gathered `:57-71`). Harness additions: wall table has 22 columns; `setInputFiles` on the new multi-file input with the three fixture files rendered as minimal `.html` wrappers → 3 floors rendered, no dialogs, adapter round-trip still passes with the new keys, `lateral` key survives `getModel/setModel`.

Diaphragm (`npm run test:dia`, new `tools/test-rect-diaphragm.mjs`, Playwright, same fulfil-from-`public/` pattern): load Nick's ROOF `are-state` through `AREv2.loadFromState` → `ok:true`, no mismatches, no dialog (the Phase 0 acceptance); `calculate()` numbers = F6; `RD.calcDir` identical to the pre-extraction inline function (golden values); `?src=mwfrs&lat=1` with a seeded `localStorage['are_lateral_v1']` → level select built, rows untouched, `#loadLevel = strength`; switching level changes `#Vx`/`#Vy`/`#level`/Mark and nothing else; Mark rule cases: blank → "3RD"; "ROOF LEVEL" (does not contain "3RD") → "3RD"; "3RD LEVEL" → unchanged; expired key → legacy fallback without row overwrite.

MWFRS (`npm run test:mwfrs`, existing harness): baseline unchanged; new check that `buildLateralPayload()` for the `enclosed-flat-3story-parapet` case returns 3 levels whose `F_wind_x_strength_lb` equal `__mwfrsLast.wx.rows[i].F_net` and `sh_ft` equal the story inputs; the SW send block is gone from `#sendPanel`.

Manual browser checklist (theme only loads when served from `public/`):
1. `python tools/nocache_server.py 8799 public` → `http://localhost:8799/Calcs/asce716_mwfrs_calculator.html`.
2. Load Nick's MWFRS file (toolbar Load) → Calculate → send panel shows one "Send all levels" block, start level Roof → click → new tab is the Diaphragm Designer with banner "3 levels from MWFRS", level select Roof/3RD/2ND, Vx 131.31 / Vy 40.86, B/D 120/360, default rows untouched.
3. Load Nick's ROOF file in that tab → clean load, no dialog; level select rebuilt from the file's `#mwfrsJSON` (after Phase 3 it has one after a re-save; before, the banner says "no story table — re-send from MWFRS").
4. Pick 3RD → Vx 79.78 / Vy 20.90, Mark becomes "3RD", rows unchanged → Save → file `… - Rectangular Diaphragm Designer - 3RD - <date>.html`. Repeat for 2ND.
5. Open `stacked_shearwall_calculator.html` → "Import diaphragm levels" → pick the three files → dialog: direction X, merge typical on → 3 floors, 2 wall rows each (`A1/A25 (2 typ.)` 20 ft, `A2–A24 (23 typ.)` 20 ft), h 11/10.5/14, P_W per wall 2,736/5,471 at Roof, floor P_W shows the level total; results render without model errors once segments/openings are entered. Repeat direction Y → 5 rows.
6. Save the shearwall → reload the file → identical model incl. per-wall forces; open an **older** shearwall file (e.g. any 2026-09-14 QAQC save) → loads, no dialog.
7. Print Summary and Full Calc from each page — no layout regressions.

### G. Deploy

Repo deploys by committing to `main` and pushing (Vercel). **Never run git in the OneDrive folder** — its in-place `.git` is stale (HEAD `5d244fc`, verified 2026-09-15); use only `/tmp/are-git` (HEAD `74cb653`, `core.worktree` → the OneDrive tree). Commit from there with explicit paths. The working tree currently has unrelated untracked files (`tools/_*.mjs`, `PLAN-CALC-LABEL.md`, `.parcelb-evidence.mjs`) and a modified `PLAN-STACKED-WOOD-QAQC-REVIEW-LOG.md` — stage by path, never `git add -A`. Each phase below is one commit and independently shippable.

---

## Data contract — `are.lateral.v1`

One object. Units in the names. `levels` top → bottom. `walls` is absent at the MWFRS stage and present at the diaphragm stage. Numbers are Nick's Red Bluff values; X interior lines abbreviated with `…`.

```json
{
  "schema": "are.lateral.v1",
  "loadLevel": "strength",
  "project": "26-038-HNR - Red Bluff Hotel",
  "source": {
    "mwfrs": { "calcFile": "asce716_mwfrs_calculator.html", "savedAt": "2026-09-16T02:20:52.168Z",
               "V_mph": 115, "exposure": "B", "enclosure": "enclosed", "Kzt": 1.00, "Ke": 0.984 },
    "files": ["26-038-HNR - Red Bluff Hotel - Rectangular Diaphragm Designer - ROOF LEVEL - 2026-09-15.html",
              "26-038-HNR - Red Bluff Hotel - Rectangular Diaphragm Designer - 3RD - 2026-09-15.html",
              "26-038-HNR - Red Bluff Hotel - Rectangular Diaphragm Designer - 2ND - 2026-09-15.html"]
  },
  "geometry": { "B_ft": 120, "D_ft": 360, "h_ft": 35.5, "hp_ft": 4.5 },
  "axes": { "X": "wind along EW; EW walls resist; loc_ft measured from S", "Y": "wind along NS; NS walls resist; loc_ft measured from W" },
  "levels": [
    {
      "index": 0, "label": "Roof", "sh_ft": 11,
      "F_wind_x_strength_lb": 131315, "F_wind_y_strength_lb": 40861,
      "F_parapet_x_strength_lb": 87160, "F_parapet_y_strength_lb": 29053,
      "V_cum_x_strength_lb": 131315, "V_cum_y_strength_lb": 40861,
      "F_seis_x_strength_lb": 0, "F_seis_y_strength_lb": 0,
      "walls": {
        "X": [
          { "id": "X@0",   "label": "A1",  "L_ft": 20, "loc_ft": 0,   "R_wind_strength_lb": 2736, "R_seis_strength_lb": 0 },
          { "id": "X@15",  "label": "A2",  "L_ft": 20, "loc_ft": 15,  "R_wind_strength_lb": 5471, "R_seis_strength_lb": 0 },
          { "id": "X@360", "label": "A25", "L_ft": 20, "loc_ft": 360, "R_wind_strength_lb": 2736, "R_seis_strength_lb": 0 }
        ],
        "Y": [
          { "id": "Y@0",   "label": "AA", "L_ft": 280, "loc_ft": 0,   "R_wind_strength_lb": 5107,  "R_seis_strength_lb": 0 },
          { "id": "Y@30",  "label": "AC", "L_ft": 160, "loc_ft": 30,  "R_wind_strength_lb": 10215, "R_seis_strength_lb": 0 },
          { "id": "Y@60",  "label": "BB", "L_ft": 120, "loc_ft": 60,  "R_wind_strength_lb": 10215, "R_seis_strength_lb": 0 },
          { "id": "Y@90",  "label": "DB", "L_ft": 360, "loc_ft": 90,  "R_wind_strength_lb": 10215, "R_seis_strength_lb": 0 },
          { "id": "Y@120", "label": "BD", "L_ft": 360, "loc_ft": 120, "R_wind_strength_lb": 5107,  "R_seis_strength_lb": 0 }
        ]
      }
    },
    { "index": 1, "label": "3RD", "sh_ft": 10.5,
      "F_wind_x_strength_lb": 79782, "F_wind_y_strength_lb": 20904, "F_parapet_x_strength_lb": 0, "F_parapet_y_strength_lb": 0,
      "V_cum_x_strength_lb": 211098, "V_cum_y_strength_lb": 61765, "F_seis_x_strength_lb": 0, "F_seis_y_strength_lb": 0,
      "walls": { "X": [ { "id": "X@0", "label": "A1", "L_ft": 20, "loc_ft": 0, "R_wind_strength_lb": 1662, "R_seis_strength_lb": 0 },
                        { "id": "X@15", "label": "A2", "L_ft": 20, "loc_ft": 15, "R_wind_strength_lb": 3324, "R_seis_strength_lb": 0 } ],
                 "Y": [ { "id": "Y@0", "label": "AA", "L_ft": 280, "loc_ft": 0, "R_wind_strength_lb": 2613, "R_seis_strength_lb": 0 },
                        { "id": "Y@30", "label": "AC", "L_ft": 160, "loc_ft": 30, "R_wind_strength_lb": 5226, "R_seis_strength_lb": 0 } ] } },
    { "index": 2, "label": "2ND", "sh_ft": 14,
      "F_wind_x_strength_lb": 87306, "F_wind_y_strength_lb": 22618, "F_parapet_x_strength_lb": 0, "F_parapet_y_strength_lb": 0,
      "V_cum_x_strength_lb": 298403, "V_cum_y_strength_lb": 84383, "F_seis_x_strength_lb": 0, "F_seis_y_strength_lb": 0,
      "walls": { "X": [ { "id": "X@0", "label": "A1", "L_ft": 20, "loc_ft": 0, "R_wind_strength_lb": 1819, "R_seis_strength_lb": 0 },
                        { "id": "X@15", "label": "A2", "L_ft": 20, "loc_ft": 15, "R_wind_strength_lb": 3638, "R_seis_strength_lb": 0 } ],
                 "Y": [ { "id": "Y@0", "label": "AA", "L_ft": 280, "loc_ft": 0, "R_wind_strength_lb": 2827, "R_seis_strength_lb": 0 },
                        { "id": "Y@30", "label": "AC", "L_ft": 160, "loc_ft": 30, "R_wind_strength_lb": 5655, "R_seis_strength_lb": 0 } ] } }
  ]
}
```

Rules:
- `loadLevel` ∈ `strength | asd`. The builder converts `asd` → strength (`÷0.6` wind, `÷0.7` seismic) **before** writing `*_strength_*`; a record never carries ASD numbers under strength names.
- `sh_ft` of level `i` = MWFRS story `i` floor-to-floor height = the wall height of the story directly below diaphragm `i` → `floors[i].h_ft`.
- `id` = `dir + '@' + round(loc_ft, 0.1)`; matched across levels with 0.5 ft tolerance. `label` is display only.
- For a diaphragm-stage level, `F_wind_x_strength_lb = round(#Vx × 1000)` — what that file actually distributed (`#Vx` is kips, 2 dp). `R_*_lb = round(reactions[i] × 1000)` (`RD.calcDir` returns kips).
- Σ `R_wind_strength_lb` over a level's `walls.X` equals `F_wind_x_strength_lb` within 0.1 % — a builder self-check on `calcDir` only. The comparison of `F_*` against `#mwfrsJSON.levels[i].F_*` (the MWFRS number) is a **warning** ("Roof Vx differs from MWFRS by n %"), never an error — Nick may have adjusted the force deliberately.
- No per-wall unit shear in the record; the shearwall engine recomputes with `C_o·Σb_i`.
- Absent `walls` = MWFRS-stage record. Absent `F_seis_*` = 0.

Resulting Stacked Shearwall wall object (direction X, merged), for `floors[0]` (Roof, `h_ft: 11`):
```json
{ "id": "X@15", "label": "A2–A24 (23 typ.)", "dir": "X", "loc_ft": 15, "L_ft": 20, "h_ft": 11,
  "P_wind_lb": 5471, "P_seis_lb": 0, "typ": { "count": 23, "members": ["A2","A3","…","A24"] },
  "segments_ft": [20], "openings": [], "unsheathed_ft2": 0,
  "sheathing": { "face1": { "type":"wsp","thickness":"7/16","nail":"8d common","spacing":6 }, "face2": null, "blocked": true, "insideFaceHoldown": false },
  "endPost": { "n": 2, "size": "2x6" }, "holdown": "hdue",
  "sill": { "conn": "sds14", "spacing_in": 12, "sheathing": "none" }, "sillSpecies": "DFL",
  "dead": { "w_plf": 0, "P_end_lb": 0, "source": "manual" }, "uplift": { "capacity_plf": null, "label": "" }, "transfer": false }
```
Floor: `{ "id": 1, "name": "Roof", "h_ft": 11, "P_wind_lb": 131315, "P_seis_lb": 0, "walls": [...] }` — the floor total is kept as the fallback and as the printed check "Σ wall lines = level force". Base floor (2ND) walls get `sill.conn 'ab58'`, `spacing_in 20` (mirrors `mkState`, `engines/stacked-shearwall.js:786-787`). Top-level: `"lateral": { "schema":"are.lateral.v1", "project":"26-038-HNR - Red Bluff Hotel", "dir":"X", "files":[…], "importedAt":"…" }`.

---

## Phased task list

Each task: files → exact functions → acceptance. Vanilla ES5-style JS, `var`, string HTML, comment density as the neighbours. Every runtime-built `<select>`/control gets `data-are-ignore`.

### Phase 0 — Diaphragm persistence fix (ships alone; fixes today's defect)
**T0.1** `public/Calcs/rectangular_diaphragm_calculator.html`
- `swRowHTML()` (`:286-292`) and the four static rows (`:167-207`): add `data-are-ignore` to `.sw-label`, `.sw-len`, `.sw-loc`. `#swJSON` remains the persisted carrier. Drop the now-unused `id="sw{dir}_*_{n}"` attributes only if nothing else references them (`grep` — nothing does; `getSWRowsForDiagram` uses classes).
- Add, just before `AREv2` is used (after `<script src="/are-utils-v2.js">`, new inline block like the headers shim): `installDiaShim()` wrapping `AREv2.loadFromState`: when `state.calcFile === 'rectangular_diaphragm_calculator.html'`, clone `state`, delete keys matching `/^#sw[XY]_(label|len|loc)_\d+$/` from `state.fields`, default `'#loadLevel': 'strength'` and `'#mwfrsJSON': ''` when absent **and only when `document.getElementById(id)` exists** — `applyIteratively` marks a key done only on an exactly-one `resolveKey` hit (`are-utils-v2.js:1547-1552`), so a defaulted key with no element lands in `missingOnPage` and triggers the rollback dialog. Until Phase 3 adds the elements the shim injects nothing. Guard with `AREv2._diaShim`.
- `loadInputsDia().buildSWRows` (`:1064-1080`): replace the inline row HTML with `rebuildSWRows(dir, rows)` so legacy JSON loads get the same markup (and the ignore attribute).
- Acceptance: Nick's ROOF file loads with `ok:true`, zero mismatches, no dialog (`tools/test-rect-diaphragm.mjs` T0.2); Save → reload round-trips 25 + 5 rows; `#swJSON` is the only `sw*` key in the new snapshot.

**T0.2** `tools/test-rect-diaphragm.mjs` (new) + `package.json` script `test:dia`; `fixtures/lateral/red-bluff/diaphragm-roof-state.json` (from Nick's file, numbers only — see Fixture provenance). Checks listed in F, including `res.mismatches.missingOnPage.length === 0` and `res.mismatches.notInFile.length === 0` on the ROOF load. Acceptance: `npm run test:dia` ALL PASS.

### Phase 1 — Engine per-wall force override
**T1.1** `public/Calcs/engines/stacked-shearwall.js`
- `storyForces(floors, caseKey, present, wallId)` (`:207-224`): per-wall lookup as in Decision C; `rows[].src`.
- `computeWall` (`:561`): `storyForces(floors, caseKey, present, w.id)[k]`.
- `validate` wall loop (`:372`): finite-number check on `w.P_wind_lb`/`w.P_seis_lb` when not `null`/`undefined`/`''`.
- `defaultWall()` (`:742`): add `P_wind_lb: null, P_seis_lb: null`.
- `FIXTURES`: add SW9–SW12 (Decision F). `res.notes` (`:444`): add "Wall-line forces, where entered, replace the level force for that line".
- Acceptance: `SW.runFixtures()` pass count = total; default-model numbers unchanged (`test-stacked-shearwall.mjs:77-85`, values gathered `:57-71`).

**T1.2** `public/Calcs/stacked_shearwall_calculator.html`
- `render()`: two `thc` columns after `l_ft` (`:577`): `thc('pw_lb',70,'P<sub>W</sub> (lb)','th-sw','Strength-level wind force delivered to THIS wall line at this level; blank = use the level force')`, same for `pe_lb`; wall row cells after `L_ft` (`:602`): number inputs, `value = w.P_wind_lb == null ? '' : w.P_wind_lb`, `placeholder="= level"`; results row `colspan="22"` (`:647`).
- `updWall` (`:449`): `case 'P_wind_lb': w.P_wind_lb = (val === '' ? null : (parseFloat(val)||0)); break;` and seismic.
- `newWallFrom()` (`:406-413`): reset `w.P_wind_lb = null; w.P_seis_lb = null; w.typ = undefined;` alongside the existing `dead`/`transfer` resets, so a hand-added wall inherits the level force and the floor-header Σ check flags it.
- Floor header (`:563-569`): hint text "level total — used by wall lines with no line force".
- `detailHtml` (`:863`): `+ (rr.src === 'wall' ? ' (wall line)' : '')`.
- Adapter `allowedKeys` (`:1045`): add `'lateral'`; `getModel` (`:1056`) adds `lateral: state.lateral || null`; `setModel` (`:1058`) adds `state.lateral = m.lateral || null` (used in Phase 4; harmless now).
- Acceptance: `npm run test:sw` ALL PASS with the new column-count assertion; typing a line force changes only that wall's `V`.

**T1.3** `docs/calc-state-spec.md §9`: shearwall row — add wall keys `P_wind_lb, P_seis_lb (null = inherit level force), dir, loc_ft, typ` and top-level `lateral`.

### Phase 2 — Shared engines: `rect-diaphragm.js` and `lateral-handoff.js`
**T2.1** `public/Calcs/engines/rect-diaphragm.js` (new, same IIFE/`module.exports` pattern as `stacked-shearwall.js:30, 1210`): `RD.ENGINE = {name:'rect-diaphragm', version:1}`, `RD.calcDir` (moved verbatim from `rectangular_diaphragm_calculator.html:644-745`), `RD.analyze({B, D, Vx, Vy, Vx_s, Vy_s, swX, swY})` → `{wx, wy, sx, sy}` (the four `calcDir` calls at `:856-863`), `RD.checkSwLocs(sws)` → duplicate-location report (logic from `:841-850`, alert-free).
- `rectangular_diaphragm_calculator.html`: `<script src="./engines/rect-diaphragm.js"></script>` before the inline script; replace the inline `calcDir` with `var calcDir = RD.calcDir;`; `calculate()` uses `RD.analyze`; `checkSwLocs` keeps its alert but calls `RD.checkSwLocs`.
- Acceptance: `npm run test:dia` numbers unchanged (F6 golden values); `node -e "require('./public/Calcs/engines/rect-diaphragm.js')"` loads.

**T2.2** `public/Calcs/engines/lateral-handoff.js` (new, DOM-free; resolves `RD` at load from `root` or `require`; resolves `SW` lazily inside `toShearwallState`/`updateForces` only — `levelFromDiaphragmState`/`assemble` never touch `SW`, because the diaphragm page loads `LH` without the shearwall engine):
- `LH.SCHEMA = 'are.lateral.v1'`, `LH.WIND_FACTOR = 0.6`, `LH.SEIS_FACTOR = 0.7`, `LH.LOC_TOL_FT = 0.5`.
- `LH.wallId(dir, loc)`.
- `LH.fromMwfrs({B, D, h, hp, stories:[{label, sh}], wx:{rows}, wy:{rows}, project, meta})` → record without `walls`.
- `LH.levelFromDiaphragmState(snapshotState)` → level record (no `SW` dependency): validates `calcFile`, parses `#swJSON` (fallback: reconstruct from `#sw*_*` keys for pre-Phase-0 files), reads `#level`, `#B`, `#D`, `#Vx`, `#Vy`, `#Vx_s`, `#Vy_s`, `#loadLevel` (default `strength` + warning), `#mwfrsJSON` (optional story table), `project`; runs `RD.analyze`; maps reactions back to rows by `loc` (because `calcDir` sorts); converts ASD → strength; returns `{level, storyTable|null, warnings[]}`.
- `LH.assemble(levelResults, opts)` → full record + `errors[]`/`warnings[]` (ordering and validation rules in Decision B). Never touches `SW`.
- `LH.toShearwallState(record, {dir, merge, sfrs, sdc, species})` → `SW` v2 state (Decision C; base-level sill rule; `lateral` provenance; every wall gets numeric `P_wind_lb` and `P_seis_lb`, 0 when absent). Resolves `SW` lazily inside this function only (the diaphragm page loads `LH` without `SW`).
- `LH.summarize(record)` → text lines for the inline import panel (levels, Σ R vs F check with `× typ.count` for merged rows, warnings).
- Acceptance: `npm run test:lat` ALL PASS (T2.3).

**T2.3** `tools/test-lateral-handoff.mjs` (new, pure node) + `package.json` `test:lat`; fixtures `fixtures/lateral/red-bluff/{mwfrs-state,diaphragm-roof-state,diaphragm-3rd-state,diaphragm-2nd-state,expected}.json`. Assertions per Decision F. Also add `test:lat` to the `qa` chain.

### Phase 3 — MWFRS sends all levels; Diaphragm level selector; remove dead button
**T3.1** `public/Calcs/asce716_mwfrs_calculator.html`
- `<script src="./engines/lateral-handoff.js"></script>` after `are-draw.js` (`:1872`).
- `buildLateralPayload()` (new, next to `buildRevitWindPayload` `:1640`): `LH.fromMwfrs(window.__mwfrsLast + stories + AREv2.getProject())`; returns `null` for `encl === 'open'` (no story rows) with the same alert pattern as `:1764`.
- `renderSend()` (`:1115-1163`): delete the Stacked Shearwall block and the X/Y level pair; one block "Send all levels to Diaphragm Designer" with `<select id="diaStory" data-are-ignore>` (start level, default Roof) and the button. Text: "Sends every story's diaphragm force (strength level, lb) plus story heights and B/D. Pick the level to open first; switch levels inside the Diaphragm Designer."
- `doSendDiaphragm()` (`:1198`): `localStorage.setItem('are_lateral_v1', JSON.stringify({record, ts: Date.now(), file: 'rectangular_diaphragm_calculator.html'}))` in try/catch; URL adds `&lat=1` and keeps `vx/vy/B/D/story` for the chosen level. Delete `doSendShear`, `updateSendPreview`, `window.updateSendPreview` (`:1870`). Update adapter comment `:1910-1913`.
- Acceptance: `npm run test:mwfrs` baseline unchanged + new payload check; no `sendDir`/`sendStory` in the DOM.

**T3.2** `public/Calcs/rectangular_diaphragm_calculator.html`
- Markup: in Lateral Loads block add `<select id="loadLevel">` (`strength` "Strength level — ASCE 7 W / E, as sent by MWFRS" | `asd` "ASD — 0.6W / 0.7E already applied") with a ref line "Stacked Shearwall handoff needs strength level; ASD entries are converted (÷0.6 wind, ÷0.7 seismic) at send"; hidden `<input type="hidden" id="mwfrsJSON">`; a "Levels from MWFRS" row: `<select id="mwfrsLevel" data-are-ignore>` + button "Next level ↓" (`data-are-ignore` not needed on buttons) + `#mwfrsInfo` span; hidden until `#mwfrsJSON` is non-empty.
- `applyMwfrsLevel(idx)`, `buildLevelSelect()`, `nextLevel()`; `#mwfrsJSON` `change` listener (like `#swJSON` `:1113`) → `buildLevelSelect()`; `AREv2.onAfterRestore(buildLevelSelect)`. Mark rule from Decision A via `AREv2.getMark()` / `#areMark`.
- URL import IIFE (`:962-1010`): `lat=1` path per Decision A; **delete the row-overwrite block** (`:981-995`) in both paths; force `#loadLevel = 'strength'` on any MWFRS import; `window.addEventListener('load')` to prefill `#areJob`/`#projName`/`#areMark` once the toolbar exists.
- **Phase 4b (only if Nick answers Q3 yes):** "Send this level to Stacked Shearwall" button in `#results` (next to the masonry button `:258-263`): builds `LH.assemble([LH.levelFromDiaphragmState(AREv2.captureState())])` — `AREv2.captureState()` is public (`are-utils-v2.js:960-978`) and returns `{calcFile, fields, project, mark, …}`, the same shape the multi-file importer parses from a saved file — write to `localStorage['are_lateral_v1']` with `file:'stacked_shearwall_calculator.html'`, open `stacked_shearwall_calculator.html?src=diaphragm&lat=1`.
- Acceptance: `npm run test:dia` new checks (Decision F); manual steps 2–4.

### Phase 4 — Stacked Shearwall import
**T4.1** `public/Calcs/stacked_shearwall_calculator.html`
- `<script src="./engines/rect-diaphragm.js">` and `./engines/lateral-handoff.js` after the engine (`:344`).
- Global Settings "Project file" cell (`:267-272`): add `<label class="btn-add-floor" style="background:#7c3aed">⇪ Import diaphragm levels<input type="file" multiple accept=".html,text/html" style="display:none" onchange="importDiaphragmLevels(event)"></label>`.
- `importDiaphragmLevels(evt)`: read all files (`Promise.all(file.text())`), `AREv2.parseSnapshot` each (skip + collect non-diaphragm files by `calcFile` with a listed error), `LH.levelFromDiaphragmState`, `LH.assemble` → if `errors.length` alert and stop; else `showImportDialog(record)`.
- `showImportDialog(record)`: inline panel under `#modelMsgs` (string HTML; every `<select>`/`<input>` `data-are-ignore`): direction X/Y radio, "Merge typical lines" checkbox (default on), the level list with `h (ft)` per level (locked when a story table supplied it, editable and required otherwise), the top→bottom order, summary from `LH.summarize`, buttons Import / Cancel. Import replaces the model: `state = LH.toShearwallState(record, {dir, merge, sfrs: state.sfrs, sdc: state.sdc, species: state.species}); wCnt = total walls; syncGlobals(); render();`.
- **Phase 4b (only if Nick answers Q3 yes):** `?src=diaphragm&lat=1` path in `window.onload` (`:1018`): read `localStorage['are_lateral_v1']`, TTL 10 min, `file` match, remove key, feed the same dialog (single level; banner "1 level — import the other level files to stack").
- Floor header: when `fl.walls.some(w => w.P_wind_lb != null)`, show "Σ wall lines = <sum> lb (level <P_wind_lb>)" where `sum = Σ P_wind_lb × (w.typ ? w.typ.count : 1)`, mismatch colour if they differ by > 1 %. The same `× typ.count` rule applies in `LH.summarize` and in the printed calc record — a merged row stands for `count` lines.
- Acceptance: `npm run test:sw` new import checks (Playwright `setInputFiles` with the three fixture files wrapped as `<html><script id="are-state" type="application/json">…</script></html>`); manual steps 5–6.

**T4.2** `docs/calc-state-spec.md §9`: new row for `rectangular-diaphragm` (Tier A; carriers `#swJSON`, `#mwfrsJSON`, `#loadLevel`; shim strips legacy row keys) and a short "are.lateral.v1" paragraph pointing at `engines/lateral-handoff.js` as the source of truth. Memory note for this session (`/remember`).

### Phase 5 — Optional polish (only if Nick asks)
- Shearwall: `LH.updateForces(state, record, {dir})` → mutates `P_wind_lb`/`P_seis_lb`/`L_ft` on matching `floors[].walls[]` by floor `name` + wall `id`, returns `{updated, missing[]}`; import-panel mode "Update forces & lengths only (keep sheathing, openings, hold-downs)". Writes numeric P (0 when absent), resolves `SW` lazily.
- MWFRS: make `reindexStories()` preserve user-edited labels (F8).
- Diaphragm: per-level wall layout differences → "Copy layout from file…" (load only `#swJSON` from another level's snapshot).

---

## Test plan (commands)

```
npm run test:dia      # Phase 0/2/3 — Playwright, diaphragm page, Red Bluff ROOF file loads clean; golden numbers; level select
npm run test:sw       # Phase 1/4 — engine fixtures SW1–SW12, wall-table columns, multi-file import, adapter round trip incl. per-wall keys
npm run test:lat      # Phase 2 — pure node, are.lateral.v1 builder/parser, Red Bluff fixtures, ASD conversion, ordering, merge
npm run test:mwfrs    # Phase 3 — baseline unchanged, payload check, dead block gone  (add script: node tools/test-mwfrs-wind.mjs)
npm run qa            # existing fleet checks (roundtrip, adversarial load, activation order) — diaphragm/shearwall files must still pass
python tools/nocache_server.py 8799 public   # manual checklist, Decision F
```

Fixture provenance: `fixtures/lateral/red-bluff/*` are the `are-state` blocks of Nick's two 2026-09-15 files with `project`, `mark`, `#projName` and `#projEng` blanked (numbers only — the repo is not a project record) plus two synthesized level files; `expected.json` values are those in F6, computed by running the shipped calcs headlessly on 2026-09-15 (script kept in `tools/_out/` is not needed — the test recomputes them).

---

## Open questions for Nick (each changes the work)

**Q1. "Seismic / Other" fields.** The handoff treats `#Vx_s`/`#Vy_s` as seismic E (Stacked Shearwall applies 0.7E). If you use those fields for anything else, say so and the builder will send them as 0 with a warning instead.

**Q2. Typical-line merge default.** Red Bluff X has 23 identical interior lines. Default is to merge them into one row labelled "A2–A24 (23 typ.)" (count printed in the calc record). Merge on by default, off, or never?

**Q3. Removing the MWFRS → Stacked Shearwall button.** Plan removes it outright. If you want a one-line quick path for single-story or single-wall-line buildings, the Diaphragm Designer can get a "Send this level to Stacked Shearwall" button that routes through the same import as a one-level record (Phase 4b) — say so and it gets built; otherwise it does not.

---

## Review integration — Codex cross-check (2026-09-15)

An independent Codex plan was produced from the same brief and compared against the above. Agreement on the core: optional per-wall force in the engine with floor fallback; adapter versions stay put; remove the dead MWFRS → shearwall button; lb + strength level at the boundary; one shared DOM-free contract module; recommended build order = engine first (until the engine takes per-wall forces, any richer handoff still duplicates the level force on every line).

### Adopted from Codex

1. **Negative reactions (Decision B validation).** `RD.calcDir` can return a negative reaction for the 2-line beam with overhangs (a line past the resultant). Wind reverses, so the wall line sees `|R|`; `LH.levelFromDiaphragmState` writes `R_wind_strength_lb = |R|`, sets `sign: -1` on the wall record, and emits a warning naming the line. Never clamp to 0. Node test: a 2-line fixture with lines at 0 and 20 of L = 120 → `R2 = 360w`, `R1 = −240w`; absolute value carried, `sign: -1` set, warning present.
2. **Missing story heights must never be silently inferred (Decision B fallback).** For diaphragm files with no `#mwfrsJSON` (pre-Phase-3 saves), the shearwall import dialog shows an editable `h (ft)` per level, blank, and refuses Import until every level has a finite height > 0. No default. Files with the story table pre-fill and lock the field.
3. **Cross-project guard on the localStorage hop (Decision A/B).** `are_lateral_v1` carries `record.project`. The receiving page compares it with `#areJob` (when non-blank) and asks "Payload is for <A>; this calc is <B>. Apply anyway?" before applying. Cheap insurance against two projects open in one browser; the 10-minute TTL already bounds the window.
4. **Popup-blocked send (Decision A/B).** `doSendDiaphragm()` / "Send this level to Stacked Shearwall" write the payload first, then `window.open`; if `open()` returns `null`, the button's neighbour `<a>` (same URL, `target=_blank`) is revealed so the user can click through. The payload is already stored, so nothing is lost.
5. **`?selftest=1`** added to the test checklist for the shearwall page (existing self-test must still pass with the new wall keys).

### Considered and rejected

- **`sessionStorage` + workflowId as the system of record (Codex §3).** `window.open` does copy `sessionStorage` to the new tab, but it dies with the tab. Nick does the roof today and the floors next week, possibly on another machine; the per-level snapshot `.html` files are already what he files and they carry everything the importer needs. Files remain the record; storage is only the immediate hop.
- **Stable UUID per wall line, carried in `#swJSON` (Codex §5).** Identity by `dir + '@' + loc` is the physical definition of a stacked wall: a line at 15 ft from the south wall on every floor is one stack. A UUID would let a line be moved 10 ft between floors and still be called stacked — that is the offset case the engine should flag, not hide. Label-matching stays rejected for the reason the headers QAQC found. If Nick ever needs to pin an offset line as a stack, that is an explicit `transfer`-style flag, not an ID scheme.
- **Workflow panel with per-level status (not created / geometry copied / calculated / stale) and dirty-flag export gating (Codex §5).** Unnecessary once the importer **recomputes** reactions from each file's inputs through `RD.calcDir` — there is no stored result to go stale. Status is visible in the folder: one file per level.
- **MWFRS-side "source refresh" that marks diaphragm results stale (Codex §4).** Same reason; plus Nick re-sends from MWFRS and re-saves the level files, which is the existing house pattern.
- **Nested `wall.loads = {P_wind_lb, P_seis_lb, source}` (Codex §8).** Flat `P_wind_lb` / `P_seis_lb` on the wall mirrors the floor keys and keeps `updWall` one line per field; provenance lives once, top-level, in `lateral`.
- **Legacy diaphragm JSON `_version` bump (Codex §6).** `loadInputsDia` already rebuilds rows through `rebuildSWRows` after Phase 0; nothing else in the legacy file changes. Leave it.

### Reviewer notes on the Fable plan itself

- Phase 1 `addWall()` clones `walls[0]` including its `P_wind_lb` override — a hand-added wall on an imported floor inherits the *first wall's* line force, not the level total. Acceptable, but `newWallFrom()` should reset `P_wind_lb`/`P_seis_lb` to `null` (inherit) like it already resets `dead` and `transfer`, so the floor-header "Σ wall lines vs level" check flags it rather than hiding it.
- Typical-line merge decides on "identical `L_ft` and identical reaction at every level" — it must run in `LH.toShearwallState` after `LH.assemble`, never per file. Stated here so an implementer does not merge per level.
- Tier-A hidden `#mwfrsJSON` has no length cap (`validateModel`'s 2000-char rule is adapter-model only — `are-utils-v2.js:1443`; `#swJSON` already carries 30 rows). Verified.

### Review round 2 — applied (2026-09-15)

1. T0.1 shim defaults `#loadLevel`/`#mwfrsJSON` only when the element exists (`applyIteratively` `:1547-1552`); T0.2 asserts zero `missingOnPage` and zero `notInFile`.
2. Mark rule: set when blank, equal to the previous label, or not containing the new label (case-insensitive) + toast; exact cases added to `test:dia`.
3. Contract: `F_* = round(#Vx × 1000)`, `R_* = round(reactions × 1000)`; Σ R = F is a `calcDir` self-check; MWFRS comparison is a warning.
4. Builder always writes numeric `P_wind_lb` and `P_seis_lb` (0 when absent); `null` reserved for hand-added walls; example fixed.
5. Σ wall lines uses `× typ.count` everywhere (floor header, `LH.summarize`, calc record); `test:lat` asserts it.
6. Merge condition made exact (presence per level, `|ΔL| ≤ 0.01`, `|ΔR| ≤ max(1 lb, 0.1 %)`); negative case added.
7. Ordering: first story table in any file; picker-order fallback only when none; fallback order and editable `h` live in the inline panel, not `confirm()`; mixed case added.
8. Negative-reaction fixture restated: lines at 0 and 20 of L = 120, `R2 = 360w`, `R1 = −240w`.
9. T3.2 uses public `AREv2.captureState()` (`:960-978`); invented seam removed.
10. Adapter `getModel`/`setModel` carry `lateral`; string limits noted.
11. Diaphragm-side `are_lateral_v1`: `file` match → remove key → cross-project guard.
12. `LH` resolves `SW` lazily in `toShearwallState`/`updateForces` only.
13. `newWallFrom` resets `P_wind_lb`/`P_seis_lb`/`typ`.
14. Assembly validation adds blank `#level` and duplicate `loc` per direction per file.
15. Line refs corrected (`:1453`, `:1465-1473`, `:1486-1490`, `:1865-1872`, `:1447-1463`, `:1210`, test `:77-85` / `:57-71`). **Not applied:** `mkState` base sill — the code is `:786-787` (`sill:` at 786, `spacing:` at 787), not `:787-788`; kept as written.
16. Section G: never run git in the OneDrive folder (stale in-place HEAD `5d244fc`); only via `/tmp/are-git`.
17. Fixtures carry numbers only (project, mark, `#projName`, `#projEng` blanked).
18. Scope: `updateForces` + "update forces only" mode moved to Phase 5; single-level quick send marked Phase 4b (Q3); `v_wind_strength_plf` dropped from the record.

---

## Nick's decisions (2026-09-15) — LOCKED, override any earlier text

- **Q1 → yes.** `#Vx_s` / `#Vy_s` are seismic E. Builder writes them to `F_seis_*_strength_lb` / `R_seis_strength_lb`; the shearwall engine applies 0.7E. No warning needed.
- **Q2 → no merge, ever.** The typical-line merge feature is **cut entirely** — not defaulted off, removed. Nick wants every line as its own editable row so spacing can be changed later (this is a simplified first pass that will be refined). Consequences: delete `merge` option, `typ` key, the "Merge typical lines" checkbox, the `× typ.count` rule (Σ wall lines is a plain sum), merge-related `test:lat` assertions, and the "(2 merged X rows | …)" alternatives — Red Bluff X imports as **25 rows per floor**, Y as 5. `newWallFrom` resets only `P_wind_lb`/`P_seis_lb`. Wall-table column count and render performance with 25 × 3 = 75 wall rows should be checked in the manual pass (the calc already handles 4 floors × several walls; 75 rows × 22 columns is the new upper bound — verify `render()` stays responsive).
- **Q3 → yes, nice to have.** Phase 4b (single-level "Send this level to Stacked Shearwall" quick send from the Diaphragm Designer, `?src=diaphragm&lat=1` path in the shearwall page) is **in scope**, built after Phase 4 multi-file import, same builder.

Implementation may begin at Phase 0.
