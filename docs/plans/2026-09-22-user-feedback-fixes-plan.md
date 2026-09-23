# User-feedback fixes — Diaphragm / Stacked Shearwall / handoff (2026-09-22)

Fable-planned from user-testing feedback. Out of scope (held pending direction): MWFRS partial-length parapet; Diaphragm seismic section; Shearwall project-information section; S1 (both directions on one page — deferred, see §F).

Repo head at planning: 80c4965. Paths under `public/` unless noted. Line numbers are against 80c4965.

## A. Findings / root causes

**D1 — titleblock does not transfer.**
- Only the toolbar Project rides `are.lateral.v1`: `LH.fromMwfrs` `project: str(o.project)` (`Calcs/engines/lateral-handoff.js:95`), `assemble` (`:357`), `toShearwallState` → `lateral.project` (`:409`). MWFRS passes `AREv2.getProject()` only (`Calcs/asce716_mwfrs_calculator.html:1734`).
- Page-local titleblock fields never leave their page: MWFRS `#projName #projNum #projDate #projEng` (`asce716_mwfrs_calculator.html:97-100`); Diaphragm `#projName #level #projDate #projEng` (`Calcs/rectangular_diaphragm_calculator.html:106-109`).
- Receivers only prefill toolbar Project when blank: Diaphragm `applyLateralRecord` (`:996-999`, also fills `#projName`); Shearwall `applyDiaphragmImport` (`Calcs/stacked_shearwall_calculator.html:1075-1076`).
- Shearwall toolbar provides `#areJob` (Project) and `#areMark` (Mark) only (`are-utils-v2.js:111-115`), both as envelope metadata (`:1014-1019`); print header `.are-ph-meta` prints Project · Mark (`:317-328`). D1 is satisfied without a Shearwall project-info section: Project via `#areJob`; engineer/job no./date carried as metadata in `state.lateral.titleblock`, shown in the provenance line (prints). Mark is not transferred (per-calc instance identity).
- Compat: `shapeHash` hashes field keys only (`are-utils-v2.js:998-1003`); adapter `allowedKeys` is depth-0 only (`:1498`) so nested `lateral.titleblock` is legal; nested strings must pass `stringPattern`/`maxStringLength 120` (`stacked_shearwall_calculator.html:1691-1695`) → use `LH.safeText`. Parsers check only `schema` + `levels[]`, so additive `titleblock` is ignored by old code.

**D2 — labels.** Defaults "North Wall"/"South Wall"/"East Wall"/"West Wall" at `rectangular_diaphragm_calculator.html:194,203,218,227`; `addSW` default `'Interior Wall '+n` (`:338`). Cosmetic: wall id is `dir@loc` (`lateral-handoff.js:66-67`). Old saved files keep their labels.

**S1 — one direction per page.** See §F (deferred).

**S2 — width / resize.** At 2048 CSS px, wide mode: default column widths sum 2184 px (`thc(...)` `:776-799`) vs `.tbl-scroll` clientWidth 1888 px. Resize unpredictable because `.wall-table{width:100%}` (`:73`) + `applyColW` setting only `minWidth` (`:710`) → browser stretches all columns proportionally. Results panes sit in a `colspan=24` row (`:867`).

**S3 — bar scale.** `dcBar` maps `min(dc,1.5)/1.5` (`:430-435`): 2/3 full = 1.00, full = 1.50, no tick/legend.

**S4 — "HD inside" on row 2.** Not a state bug: the checkbox's only engine effect is `fn10 = 0.92` gated on `s.nail === '10d common'` (`engines/stacked-shearwall.js:657-663`); default/cloned walls use 8d, so nothing visible changes. A line-mate mirrors the tick via `LINE_FIELDS` (`:528`), which is the only feedback the user saw. Latent bug: `importProject` (`:1597-1617`) never refreshes `wCnt` → later "+ Wall Line" can mint a duplicate id and silently merge two walls into one line.

**S5 / S8 — clipped controls.** `are-theme-v2.css:66-74` `padding:8px 11px !important;font-size:.92em !important` beats `.ti{padding:3px 4px}` (`:94`). Floor `h` input 58 px (`:759`) clips "10.5"; ply select 44 px (`:826`) hides "(2)".

**S6 — print.** (1) `@page{size:letter portrait}` from the page (`:193-196`) and from the toolbar's injected `#are-print-v2` (`are-utils-v2.js:353`), which wins → Chromium keeps the letter page box centred on a 24×36 sheet. (2) Wall table is 1924 px wide under print media vs ~720 px available. Print CSS also targets `.chk-table` (`:233,236`); page uses `.chk-tbl`.

**S9** — "How to use" is one 9-line paragraph (`:321-329`); no visual grouping of rows on one line.

## B. Work packages

Wave 1 (parallel, disjoint files): WP-1, WP-2. Wave 2 (after WP-2, same file): WP-3.

### WP-1 — Handoff titleblock (D1) + Diaphragm labels/hint (D2)
Files: `engines/lateral-handoff.js`, `rectangular_diaphragm_calculator.html`, `asce716_mwfrs_calculator.html`, `tools/test-lateral-handoff.mjs`, `tools/test-mwfrs-wind.mjs`, `tools/test-rect-diaphragm.mjs`. Must not touch `stacked_shearwall_calculator.html`.
1. `lateral-handoff.js`: `titleblock(o)` → `{projectName, jobNumber, engineer, date}` each `safeText`; `mergeTitleblock(list, warnings)` (first non-blank per key wins; differing non-blank → warning). `fromMwfrs` (`:94-99`) adds `titleblock`. `levelFromDiaphragmState` (`:235`) merges page fields `#projName/#projEng/#projDate` with embedded `#mwfrsJSON` titleblock. `assemble` (`:356-368`) merges across levels. `toShearwallState` (`:408-412`): `lateral.titleblock = record.titleblock || null`. Export both. Precedence (file header): senders always emit; receivers fill blank fields only.
2. MWFRS `:1732-1736`: pass `titleblock` from `#projName #projNum #projEng #projDate`.
3. Diaphragm `applyLateralRecord` (`:986-1005`): fill `#projEng`, `#projDate` when blank; `#areJob` fallback `jobNumber + ' ' + projectName` when `record.project` blank.
4. D2: labels → "North side"/"South side"/"East side"/"West side"; `addSW` → `'Interior line '+n`; headings → "EW shearwall lines — resist Wind-X (Vx)" (and NS equivalent); `.ref` hint under "Shearwall Layout": one row per wall line (grid line), not per wall segment; the Stacked Shearwall Designer consumes the line reaction and splits it into walls.
5. Tests: test-lateral-handoff (sanitized titleblock; four keys populated via page + embedded MWFRS; differing engineers → warning; SW adapter regex passes); test-mwfrs-wind (jobNumber carried); test-rect-diaphragm (fill-when-blank, no overwrite).
Acceptance: `test:lat`, `test:mwfrs`, `test:dia` green; pre-change Diaphragm snapshot still loads.

### WP-2 — Shearwall presentation: S2, S3, S5, S6, S8
Files: `stacked_shearwall_calculator.html` (CSS, `dcBar`, `applyColW/resetColW`, `thc` calls, action cells, check header, script tag), `are-utils-v2.js:343-357` (additive), `tools/test-stacked-shearwall.mjs:62-63`, new `tools/test-sw-print.mjs`, `package.json` `test:swprint`.
1. S5/S8: `.wall-table input.ti,.wall-table select.ti,.floor-hdr input.ti{padding:2px 4px !important;font-size:.80em !important;border-width:1px !important;border-radius:3px !important;height:auto}`; `select.ti{padding:2px 1px !important}`; floor `h` 66 px; ply select 50 px.
2. S2 columns: defaults 85,90,50,78,66,66,85,95,50,125,125,44,96,64,112,54,78,62,165,86,56,62 + merge `detail`/`x` into one 70 px "Actions" column (Σ 1864). `.content{padding:16px}`, `.floor-body{padding:10px 8px}`. Results colspan 24 → 23. Update test expectations (cols 23).
3. S2 resize: `.wall-table{width:auto}`; `applyColW` sets table `style.width = sum+'px'`; `COLW_KEY` → `'areCalcs_sw_colWidths_v2'`.
4. S2 sticky first column (opaque backgrounds); `.wres{position:sticky;left:0}` width = scroller clientWidth; `resize` listener. No page-level horizontal scroll at 2048.
5. S3: 100 % tick at 66.667 %, `title` tooltip explaining scale/colours; header `D/C (bar 0–1.5 · | = 1.0)`.
6. S6: `data-are-print-page` attribute on the loader script suppresses the injected `@page` (additive; other calcs unchanged). Page `@page{size:17in 11in;margin:.4in .45in}`. Print block: small table font, repeat thead, plain inputs, hide Actions column, static `.wres`, visible overflow, avoid breaks inside result blocks, fix `.chk-table`→`.chk-tbl`.
7. `tools/test-sw-print.mjs`: print-media width fits 1555 px; no `@page` in `#are-print-v2`; `page.pdf({preferCSSPageSize:true})` MediaBox `[0 0 1224 792]`; screen at 2048: no page h-scroll, `10.5` not clipped, ply text visible.
Acceptance: `test:sw`, `test:swprint`, `qa:toolbar` green; roundtrip.

### WP-3 — Shearwall behaviour + docs + D1 receiver: S4, S9, D1(SW), S7 option
1. S4: disable HD-inside box with "n/a" + explanatory title when neither face uses 10d common (state kept); SHEATHING conn-row appends "× 0.92 (HD inside, Table 4.3A fn. 10)" when applied. `refreshWCnt()` in `importProject` and `setModel`. Regression tests incl. stale-wCnt case.
2. S9: callout → 3 bullets + worked example (Line B: B 20 ft b_i 8,8 and B-2 12 ft b_i 12 share V_line by C_o·Σb_i). Line grouping classes `line-grp`/`line-cont` with left border and "↳ same line" cue. `+ line` → "+ wall" with title.
3. D1 receiver: `#areJob` fill-when-blank; provenance line appends Job/Project/Eng./date; import panel shows job no./engineer. Guard old files (`lateral` null).
4. S7 option: `= framing` option on sill-species select (engine already falls back). Do not change default.
Acceptance: `test:sw` green incl. new checks; pre-change SW snapshot loads with identical results.

## C. Risks / compatibility
- No field ids added/renamed → `shapeHash`, `SNAP_SCHEMA`, `are.lateral.v1` unchanged; `titleblock` additive.
- Titleblock strings through `LH.safeText` or `validateModel` rejects the file.
- Column count 24→23, `COLW_KEY` bump (stored widths discarded once).
- `are-utils-v2.js` change attribute-gated; run `qa:toolbar`. `are-theme-v2.css` untouched.

## E. S7 recommendation
Keep sill species separate. The base sill is pressure-treated and often a different species from the studs (HF/SPF PT in the West, SP PT in the Southeast). Sill species governs plate-washer bearing F_c⊥ (DF-L 625 vs HF/SPF 425 psi), SDS head pull-through, LTP4 row, and lower-G sill nailing. Suggested UX: "= framing" default above the base, explicit species at the base — default change is Nick's call.

## F. S1 — DEFERRED
Smallest real fix: import both directions, keep active in `state.floors`, park the other under `state.lateral.other = {dir, floors, wCnt}`, "X ⇄ Y" toggle swaps them, print both. ≈1 day incl. adapter round-trip, copy-down/undo, QA-harness updates. Workflow feature — held pending direction.
