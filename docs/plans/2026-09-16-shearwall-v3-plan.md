# Plan — Stacked Shearwall v3: SPF values, automatic bottom-plate uplift, segmented method, wall lines, copy-down, shared full-width toggle

_2026-09-16. Planning only; no production file changed. Live head d332da1. Repo `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\ARE Web Calcs\anderson-rohr-calcs`. Every `file:line` below was read in the working tree on this date._

## Summary

Six independently shippable phases, smallest risk first:

| # | Phase | Touches | Result |
|---|---|---|---|
| F | Shared "Wide" toggle in the toolbar | `are-utils-v2.js`, 3 calc pages, 2 harnesses | one button, one rule, per-calc default; the shearwall's page-local button is retired |
| A | SPF / SP hardware values | `engines/stacked-shearwall.js` data tables + `validate()`, page notes | 16d nail by species (Table 12N), HDUE refused for SPF under ESR-2330 (catalog SPF/HF values are a NEEDS-SOURCE), LTP4 SPF/HF NEEDS-SOURCE, strap refusal kept |
| B | Automatic bottom-plate uplift capacity | engine `upliftCapacity()`, wall table, check rows | one bottom-plate connection spec feeds shear, uplift and the NDS §12.4 combined check; manual override kept; old files load |
| C | Perforated vs segmented per wall | engine `computeWall()` branch, page column + detail | `wall.method`; segmented = SDPWS §4.3.2.1 individual full-height segments with §4.3.5.5.1 Exc. 1 distribution |
| D | Several walls on one line | engine share + line force, page "+ Wall on this line" | `wall.line` key, share by design capacity (= length for opening-free walls), Σ over lines |
| E | Copy wall geometry to the levels below | page only | per-floor button, base-floor sill preserved, one-step undo |

No adapter version bump, no new top-level state key, no change to the diaphragm designer or to `LH.toShearwallState`.

## Findings (verified in code)

### F1. Engine shape and species-dependent values (`public/Calcs/engines/stacked-shearwall.js`)
- `SPECIES` `:53-57`: DFL G 0.50, SP 0.55, SPF 0.42 — matches NDS 2018 Table 12.3.3A (PDF p. 101: "Spruce-Pine-Fir 0.42 … Spruce-Pine-Fir (South) 0.36"). `sheathingCapacity` `:256-260` applies the Table 4.3A fn. 3 factor from the framing G. `endPostCheck` `:291-325` uses `SPECIES[..].Fc/Emin`. Bearing (F_c⊥) is not used anywhere in this engine.
- `HOLDOWNS` `:109-116` + `holdownCapacity` `:119-127`: gated on member thickness / width only. **Species is never checked**, so an SPF model silently gets the DF/SP ESR-2330 Table 2B values. ESR-2330 §3.2.2 (p. 3): "Wood members with which the hold-downs are used, must be … having a minimum specific gravity of 0.50". Table 2B has no SPF/HF column (p. 9, columns are thickness 3 / 3.5 / 4.5 / 5.5 / 7.25 / 5.5(7)). The ESR does not cover SPF at all.
- `STRAPS` / `STRAP_MIN_G 0.50` `:131-136`, refusal at `validate` `:432-436`: correct — ESR-2105 Table 4 fn. 2 (p. 10): "based on the steel straps connected to wood members having an assigned or equivalent minimum specific gravity of 0.50". No SPF/HF value exists in the ESR.
- `SILL_CONN` `:139-153`: `ltp4` Vconn 715 flat (DF/SP, C-C-2026 p. 309, direction G, C_D 1.6 — appendix C §4); `16d` Vconn 226 flat (Table 12N G = 0.50 only); `sds14` and both anchor bolts already `bySillSpecies` with SPF. The sill species selector `:670` only affects `bySillSpecies` connectors (`computeWall` `:672-673`).
- Bottom-plate uplift is a typed plf: `:694-695` (`w.uplift.capacity_plf`), check row `:719-725` (`pass: null` → "connector required" when blank), page cell `:671`, `updWall 'upliftCap'` `:494-497`, detail `:1091-1098`, conn-box line `:1006-1007`.
- Method is hard-wired perforated: `computeWall` `:508-523` always builds `C_o`, `A_o`, lever `C_o·Σb_i`; `validate` `:378` (h ≤ 20 ft, §4.3.2.3(8)), `:399-401` (Σb_i), `:418` (face 1 must be WSP), `:555-560` (2,435 plf cap) are perforated rules. `sumBi` `:163-175` already implements "excluded > 3.5, × 2b/h for 2 < h/b ≤ 3.5" — reusable for the segmented method (see Decision C).
- Per-wall line force: `storyForces` `:211-230` takes the wall's own `P_*` when finite (src `wall`), else the level force. One diaphragm line = one wall row = whole line reaction (`LH.toShearwallState` `lateral-handoff.js:392-402`). Walls stack by `id`; continuity `validate` `:345-372`.
- `defaultWall` `:763-775`, `mkState` `:801-825`, fixtures SW1–SW47 `:828-1212`, exports `:1265-1278`.

### F2. Page (`public/Calcs/stacked_shearwall_calculator.html`)
- Manage-levels buttons `:274-278`; page-local Full-width `#wideBtn` `:277`, `WIDE_KEY 'areCalcs_sw_wide'`, `applyWide/toggleWide` `:518-533`, comment says "Default on".
- Wall table columns `:617-638` (22 columns, `colspan="22"` `:692`), row cells `:644-692`, `+ Wall Line` `:695`. `updWall` `:470-503`. `addWall` `:448-455` clones `walls[0]` via `newWallFrom` `:426-434` (resets dead/transfer/P_*). `setDLSource` `:505-512` is the precedent for a per-id cascade down the stack.
- Results: `wallHtml` `:931-1015` (cards `:957-964`, case table `:966-974`, check rows `:976-991`, conn-box `:993-1008`), `detailHtml` `:1018-1125`, `expandWall` `:736-742` opens `det(fi*200+wi*10+1..6)` — room for 6 check rows per wall.
- Floor header Σ of line forces `lineSumHTML` `:751-759` sums every wall row (signed).
- Adapter `:1252-1293`: `version: 2`, `ownedFields ['#floor-con']`, `allowedKeys ['version','floors','wCnt','lateral']` `:1257` (enforced at depth 0 only, `are-utils-v2.js:1453`), `maxStringLength 120`, `setModel` `:1270-1285` refuses non-2. `AREv2.loadFromState` refuses an adapter-version mismatch `are-utils-v2.js:1501-1503` — never bump.
- Reference-table text that must change with A: strap note `:323` ("not available with SPF framing" — stays), hardware note `:348` ("All are DF/SP '160' values").

### F3. Lateral handoff and diaphragm
- `rect-diaphragm.js:27-59` computes reactions per line; `:62` `unitShears = R/len` is display only. `len` never enters the reaction. The diaphragm therefore delivers a **per-line force**; the wall length it carries is a label that becomes `L_ft` on import (`lateral-handoff.js:394`).
- `test:lat` asserts on `toShearwallState` output at `tools/test-lateral-handoff.mjs:141-171` (25 walls per floor, ids, sill defaults, provenance). None of these change under this plan.

### F4. Toolbar and theme
- `are-utils-v2.js`: `injectToolbar()` `:107-149` builds `#areBar` with buttons `:117-124`; `themeOptedOut()` `:62-65` (`data-no-theme` on the script tag — precedent for a script-tag flag); `AREv2.expandAll/collapseAll` `:555-566`; `init()` `:1922-1942` (theme → print rules → toolbar). Tier-A capture ignores anything inside `.are-bar` `:854`. Print rules hide `.are-bar` `:339`.
- `are-theme-v2.css:25` `body.are-wide .container{max-width:none !important}` already exists (shipped with d332da1); `:26-30` caps `.container` at 1280px `!important`; `:128-147` bar layout `flex-wrap:nowrap`, wraps below 760px.
- `tools/verify-toolbar.mjs:60-75` asserts `bars === 1`, `#areSaveBtn`, snapshot save, `AREv2.buildSnapshot`, zero errors — a new button in the bar changes none of these. `tools/test-stacked-headers.mjs` and `tools/test-rect-diaphragm.mjs` only `waitForSelector('#areBar')`.
- Headers page `.container{max-width:1600px}` `:11` and diaphragm `.container{max-width:960px}` `:10` are both overridden by the theme's 1280px today; both pages have their own print CSS setting the container to 100% (`:177-183`, `:64`). Neither page has a wide toggle.

### F5. Harness (`tools/test-stacked-shearwall.mjs`)
- Column count 22 `:75-76`; uplift input located by `input[title*="uplift connector"]` `:103`; page-local wide toggle `:112-123` (`#wideBtn`, key `areCalcs_sw_wide`); sill table 5 rows `:141`; HDUE table values `:134-137`.

### F6. Sources on disk vs not
- On disk and read: NDS 2018 + Commentary, SDPWS 2021 + Commentary, SDPWS 2015 + Commentary, WoodWorks five-over-one (Dec 2017).
- **Not on disk** (appendix C reached them by URL in September): ESR-2330, ESR-2105, ESR-2236, ESR-3096, Simpson C-C-2026, C-F-14. For this plan the three ICC-ES reports were read from icc-es.org on 2026-09-16 (ESR-2330 reissued May 2026; ESR-2105 Jan 2026; ESR-2236) — every number quoted from them below is marked *(web)* and must be pinned into `Technical Resources - Documents\…\Simpson\` before the phase that uses it ships. The C-C-2026 catalog pages (HDUE SPF/HF, LTP4 SPF/HF, sole-to-rim SDS table) were **not** re-read; they are NEEDS-SOURCE items.

### F7. Code text that settles the design questions
- **Aspect ratio for individual full-height walls** — SDPWS 2021 §4.3.3.2 (PDF p. 37, printed p. 31): "For wood structural panel shear walls with aspect ratios (h/b) greater than 2:1, the nominal shear capacity shall be multiplied by the Aspect Ratio Factor (WSP) = 1.25 − 0.125 h/b." C4.3.3.2 (p. 102): "applicable to blocked wood structural panel shear walls designed to resist **either wind or seismic** forces." §4.3.5.5.1 Exception 1 (p. 39): distribution in a line "proportional to the design shear capacities of the individual full-height shear walls provided that the nominal shear capacities of all full-height shear walls with aspect ratios (h/b) greater than 2:1 are multiplied by 2b/h. Where multiplied by 2b/h, the nominal shear capacities need not be further reduced by the adjustment in 4.3.3.2." Example C4.3.5.5.1-2 note (p. 116): the two are "separate checks", not cumulative, and the 2b/h path governs. SDPWS 2015 §4.3.4.2 and §4.3.3.4.1 Exc. 1 (PDF p. 35) carry the identical wording. **So there is no 2015-vs-2021 difference and no wind-vs-seismic difference**: the 2b/h factor applies to both cases. The task brief's premise ("wind 3.5:1 at full capacity") is wrong for WSP; Table 4.3.3 note 2's 3.5:1-for-wind concession is for the gypsum face only (already in `gypLimit` `:536-540`).
- **Perforated uniform uplift is perforated-only** — §4.3.6.4.2.1 (p. 42) "perforated shear wall bottom plates at full height sheathing shall be anchored for a uniform uplift force, t, equal to … ν_max"; §4.3.6.4.2 (p. 42) requires "an anchoring device … at the end of each shear wall" where dead load is insufficient — that is the segmented rule.
- **Nail withdrawal** — NDS §12.2.3.1(a) Eq. 12.2-3 `W = 1380 G^2.5 D`, Table 12.2C (PDF p. 93, printed p. 79) in lb/in of penetration; (c) multiplied by "the length of fastener penetration, p_t, into the wood member". §12.1.6.4 (p. 89): "The minimum length of nail or spike penetration, p_min, including the length of the tapered tip … shall be 6D." §12.5.4.1 (p. 105): toe-nail withdrawal × C_tn = 0.67 (out of scope, see B). Table 2.3.2 (p. 25): wind/earthquake C_D 1.6; fn. 2 caps connections at 1.6.
- **Screw withdrawal** — ESR-2236 §4.1.3 *(web, p. 3)*: "Reference withdrawal (W) design values for SDS screws must be derived according to provisions for wood screws in the NDS. For purposes of determining NDS tabulated withdrawal design values, the SDS screws are classified as a No. 14 wood screw." Table 5 *(web, p. 9)*: W = **172 lb/in** of thread penetration for every SDS length, "based on wood members having a minimum SG_NDS of 0.50" (fn. 3), reference value — adjustment factors apply (fn. 1); L_thread for SDS ¼×4½ = 2¾ in; "Embedded thread length is that portion held in the main member including the screw tip" (fn. 2). Check: NDS Eq. 12.2-2 `W = 2850 G² D`, D(No. 14) = 0.242 (Table L3, p. 196): 2850 × 0.25 × 0.242 = 172.4 ✓. NDS Table 12.2B (p. 92, printed p. 78) No. 14 column: G 0.55 → **208**, 0.50 → **172**, 0.42 → **121**.
- **Combined lateral + withdrawal** — NDS §12.4.1 (screws) Eq. 12.4-1 and §12.4.2 (nails) Eq. 12.4-2 (p. 103, printed p. 89): `Z'_α = (W'p)Z' / ((W'p)cos²α + Z' sin²α)`, α = angle between the wood surface and the load, p = penetration into the main member. Mandatory wording ("shall be determined").
- **16d common lateral by species** — Table 12N (p. 125, printed p. 111), t_s = 1½ in, D 0.162: G 0.55 → 154, 0.50 → 141, 0.42 → 120 lb (C_D 1.0). Header: "both members of identical specific gravity"; fn. 3: penetration < 10D but ≥ 6D → × p/10D. Nail dimensions Table L4 (p. 196, printed p. 182): common 8d 0.131×2½, 10d 0.148×3, 16d 0.162×3½; box 8d 0.113×2½, 10d 0.128×3, 16d 0.135×3½.
- **WoodWorks five-story** (§6, PDF pp. 33-41): one 29 ft segmented wall, h/w 0.34, ASD v = 0.7F/l (Table 7 p. 35), cumulative M_OT/d with continuous rod and stacked chord posts (Table 8 p. 40, d = distance rod-to-post centroid). The segmented branch below reproduces its v and M_OT; it uses b (segment length) as the lever per SDPWS Eq. 4.3-7, which the September QAQC already discloses (S-21) as 7–10 % below WoodWorks' d.

## Decisions

### A. SPF (and SP) design values — sweep result and what to add

Sweep of both engines and pages for every hardware/fastener value that is DF/SP-only or silently uses G = 0.50:

| Item | Where | Today | Decision | Source |
|---|---|---|---|---|
| Framing G | `SPECIES` `:53-57` | 0.50 / 0.55 / 0.42 | keep; **SPF-S not added** (G 0.36 is a different species group; Nick does not specify it; every table would need a fourth column) | NDS Table 12.3.3A p. 101 |
| HDUE hold-downs | `HOLDOWNS` `:109-116`, pick `:645-667` | DF/SP values used for every species | **Refuse for SPF framing** in `validate()` with: "HDUE hold-downs are evaluated for members with G ≥ 0.50 (ESR-2330 §3.2.2); Spruce-Pine-Fir has G = 0.42 — supply the Simpson catalog SPF/HF value or change the framing species." Add a `bySpecies` slot on each `HOLDOWNS` row (`{DFL:steps, SP:steps, SPF:null}`) so the catalog SPF/HF column drops in without restructuring. **NEEDS-SOURCE #1:** C-C-2026 HDUE table, SPF/HF column, for all six models × thickness steps. | ESR-2330 §3.2.2 p. 3 *(web)*; Table 2B p. 9 fn. 2, 6, 7 *(web)* |
| CMST straps | `STRAPS` `:131-136`, `:432-436` | refused for G < 0.50 | keep as is — the ESR has no SPF/HF value; no catalog factor is published under the ESR | ESR-2105 Table 4 fn. 2 p. 10 *(web)* |
| LTP4 | `SILL_CONN[0]` `:140-141` | 715 flat | make `bySillSpecies {DFL:715, SP:715, SPF:null}`; SPF → validation error "LTP4 allowable shear for SPF/HF framing is not on file — choose 16d nails or SDS screws, or supply the C-C-2026 SPF/HF row". **NEEDS-SOURCE #2:** C-C-2026 p. 309–310 LTP4 SPF/HF row (12–0.131×1½ nails, direction G). | appendix C §4 |
| 16d common nails | `SILL_CONN[1]` `:142-143` | 226 flat (G 0.50) | `bySillSpecies {DFL:226, SP:246, SPF:192}` = Table 12N t_s 1½, D 0.162 → 141 / 154 / 120 × C_D 1.6. Species used = the **lower** of the sill species and the framing species (Table 12N is "both members of identical specific gravity"); print which governed. With phase B the penetration input also drives Table 12N fn. 3 (p < 10D = 1.62 in → × p/10D; p < 6D = 0.97 in → error). | NDS Table 12N p. 125 |
| SDS ¼×4½ shear | `SILL_CONN[2]` `:144-146` | 400 / 400 / 304 | keep (already by species; 304 is the "either member SPF/HF" row) | appendix C §6 |
| Anchor bolts | `SILL_CONN[3-4]` `:147-152` | 1040/1488 DF-SP, 944/1360 SPF | keep. Optional (conservative today): SP could use the Table 12E G = 0.55 column (NDS PDF p. 111) — not required; leave unless Nick wants the exact SP number. | NDS Table 12E |
| Sheathing SG factor | `:256-260` | 0.92 for SPF | keep (correct) | Table 4.3A fn. 3 |
| End post F_c, E_min | `:56` | SPF 1150 / 510,000 | keep (QAQC confirmed all SPF No. 2 values) | NDS Supp. Table 4A |
| Bearing F_c⊥ | — | not used in this engine | no action (a sill-crushing check under the end post is out of this scope) | — |
| `stacked-headers.js` | `NDS_REF` `:40-46` | SPF complete (Fb 875, Fv 135, F_c⊥ 425, Fc 1150, E 1.4M, E_min 510k) | **no change** — the headers engine has no hardware tables | QAQC §1 "confirmed correct" |

Page text changes: `:348` "All are DF/SP '160' values" → list the species-dependent ones and the SPF refusals; `:323` unchanged. `renderRefTables` `:1150-1157` prints `bySillSpecies` as "DF / SP / SPF" (three values, "n/a" where null).

**Backward compatibility:** data-only, plus two new validation errors (HDUE+SPF, LTP4+SPF) that can only fire on a model that was already getting a wrong number.

### B. Automatic bottom-plate uplift capacity (SDPWS §4.3.6.4.2.1, t = v_max)

**Recommendation: one "bottom-plate connection" spec per wall (`sill.conn`, `sill.spacing_in`, plus a new penetration / bolt-tension input) that feeds three check rows — shear (existing), uplift (new, computed), and combined shear + uplift (new, NDS §12.4).** Manual override kept. Perforated walls only.

Capacity basis per connector family:

| Connector (`sill.conn`) | Uplift per fastener | Inputs | Basis |
|---|---|---|---|
| Nails: `16d` (existing), plus new `10d`, `8d` common and `16dbox`, `10dbox`, `8dbox` | `W(G, D) × p × 1.6` | `penetration_in` p (default = L_nail − 1.5 in, editable — a ¾ in subfloor under the plate takes 0.75 off) | NDS §12.2.3.1, Table 12.2C p. 93; C_D 1.6 Table 2.3.2; p ≥ 6D (§12.1.6.4) enforced as an error; G = the **receiving** member (framing species, `state.species`) |
| `sds14` SDS ¼×4½ | `W_sds(G) × p_thread × 1.6` | `penetration_in` = screw penetration into the receiving member (default 4.5 − 1.5 = 3.0); `p_thread = min(2.75, penetration_in)` | ESR-2236 §4.1.3 + Table 5 *(web)*: 172 lb/in at G ≥ 0.50; SPF → NDS Table 12.2B No. 14, G 0.42 → 121 lb/in (the derivation the ESR itself prescribes; Table 5 tabulates G ≥ 0.50 only — say so in the basis text); SP → 208 lb/in (Table 12.2B) or 172 conservatively — use 208 with the same citation |
| `ab12`, `ab58` (base) | `T_allow_lb` per bolt (typed) | `T_allow_lb` | bolt/plate-washer/concrete path is outside wood withdrawal; Nick enters the allowable tension per bolt (ACI 318 Ch. 17 / rod steel, already stated out of scope `:347`); the §4.3.6.4.3 plate-washer note already prints `:687-690`. Blank → row stays "specify". |
| `ltp4` | none | — | LTP4 is rated for F1/F2 shear only (C-C-2026 G/H directions); capacity null with message "LTP4 is not rated for uplift — set the uplift source to a separate fastener or enter a manual value". |
| `manual` (uplift source) | typed plf | `capacity_plf`, `label` | old behaviour |

Nail table (add to the engine as `NAILS`, NDS Table L4 p. 196): common 8d 0.131×2½, 10d 0.148×3, 16d 0.162×3½; box 8d 0.113×2½, 10d 0.128×3, 16d 0.135×3½. Table 12.2C rows to embed (lb/in): G 0.42 → 0.113: 18, 0.128: 20, 0.131: 21, 0.135: 21, 0.148: 23, 0.162: 26; G 0.50 → 28, 31, 32, 33, 36, 40; G 0.55 → 35, 40, 41, 42, 46, 50. Lateral Z for the new nail sizes from Table 12N t_s 1½ (p. 125), G 0.55 / 0.50 / 0.42: 0.131 → 106/97/82; 0.148 → 128/118/100; 0.162 → 154/141/120; 0.113 → 79/72/61; 0.128 → 101/93/79; 0.135 → 113/103/88.

Toe-nails: **out of scope** (C_tn 0.67 on W, §12.5.4.1). The bottom-plate-to-rim/plate connection modelled here is face-nailed; a toe-nailed plate gets the manual option.

Combined loading (NDS §12.4): in a perforated wall the same fastener sees v_max in shear and t = v_max in withdrawal at the same location (§4.3.6.4.1.1 and §4.3.6.4.2.1 both name "full height sheathing" at the base). Resultant per fastener `R = √(v² + t²)·s/12` at `α = atan(t/v) = 45°`; allowable `Z'_α = (W'p)·Z' / ((W'p)cos²α + Z' sin²α)` with `W'p` = the uplift-per-fastener above and `Z'` = the sill-shear per-fastener value already in `SILL_CONN` (both at C_D 1.6). Eq. 12.4-2 for nails, Eq. 12.4-1 for SDS (ESR-2236 §4.1.3 classifies SDS as a wood screw). Not applied to anchor bolts (no NDS interaction for bolt tension) or LTP4. **Recommend applying it as a third check row** — the NDS wording is mandatory and it is one formula (open question 3 lets Nick demote it to a note).

Worked numbers (fixtures SW51–SW55):
- 16d common, DFL receiving, p = 2.0 in, 16 in o.c.: W 40 → 40 × 2.0 × 1.6 = **128 lb** → **96.0 plf**. SPF: 26 → 83.2 lb → **62.4 plf**. SP: 50 → 160 lb → **120.0 plf**.
- SDS ¼×4½, DFL, p 3.0 → p_thread 2.75, 12 in o.c.: 172 × 2.75 × 1.6 = **756.8 lb** → **756.8 plf**. SPF: 121 → 532.4 lb → **532.4 plf**.
- Combined, 16d DFL @ 16 in: Z' 226, W'p 128 → Z'_45 = 2·128·226/(128+226) = **163.4 lb** → resultant allowable 122.6 plf → allowable v_max = 122.6/√2 = **86.7 plf** (vs 169.5 plf shear-only and 96.0 plf uplift-only — combined governs). SDS DFL @ 12 in: Z' 400, W'p 756.8 → Z'_45 = **523.4 lb** → v_max allowable **370.1 plf**.
- Anchor bolt T_allow 2,000 lb @ 20 in → **1,200 plf**.
- 6D gate: 16d p = 0.9 in < 0.972 → error.

Engine: `upliftCapacity(wall, speciesId, sillSpeciesId, isBase)` → `{plf, perFastener, W, p, CD, basis, factors[], errors[], source}`; `combinedCheck(wall, Zconn, Wp, vmax)` → `{Zalpha, alpha, demand, capacity, dc}`. Called from `computeWall` in place of `:694-695`; check rows inserted after `holdown` (`:719-725` replaced; new `combined` row after it). The uplift row's `pass` stays `null` ("specify") when the needed input (penetration or T_allow) is blank, exactly as today's blank plf, so the amber banner logic `:937-951` is unchanged.

Model (`wall.uplift`):
```
{ source: 'sill' | 'manual',      // default 'sill'
  penetration_in: number|null,    // nails / SDS, into the receiving member
  washer_in: number|null,         // anchor bolts: plate-washer side, in (LOCKED item 4 replaced T_allow_lb)
  capacity_plf: number|null,      // manual only (kept for old files)
  label: string }                 // manual only
```
`SW.normalizeWall(w)` (new, non-mutating, called by `validate/compute`, page `setModel` and `importProject`): old `{capacity_plf, label}` → `source:'manual'` when `capacity_plf` is finite, else `source:'sill'` with `penetration_in:null` (→ "specify"). Fixture SW40 keeps its numbers; its "connector required" text becomes "penetration required" — update the fixture and the harness selector at `tools/test-stacked-shearwall.mjs:103`.

Page: the `Uplift (plf)` column `:633/:671` becomes `Uplift` (150 px): `<select source>` (Auto from sill / Manual) + one `<input>` whose label follows the sill connector (penetration in / T_allow lb / plf). `updWall` gains `upliftSource`, `upliftPen`, `upliftT`. Detail `:1091-1098` prints W, p, C_D, spacing and the basis; a new `combined` detail prints α, Z', W'p, Z'_α. Conn-box UPLIFT line `:1006-1007` prints the computed plf and basis. Ref table: add a "Bottom-plate uplift (per fastener, C_D 1.6)" table rendered from `NAILS` / `SILL_CONN`.

### C. Perforated vs segmented per wall

`wall.method: 'perforated' | 'segmented'`, default perforated (absent → perforated in `normalizeWall`). Segmented = SDPWS §4.3.2.1 individual full-height wall segments, one hold-down pair per segment, HDUE + straps only (no continuous-rod system).

Segmented rules (all verified in F7):
- Segments: `segments_ft` are the individual full-height shear walls. `openings` are optional gaps (only Σ segments + Σ openings ≤ L is checked, `:409`); `unsheathed_ft2` ignored. Any segment with h/b > 3.5 is a **validation error** (Table 4.3.3: not a shear wall; unlike the perforated method there is nothing to "exclude" it into). 2 < h/b ≤ 3.5 → factor `f_i = 2b_i/h` on that segment's nominal capacity (§4.3.5.5.1 Exc. 1; "need not be further reduced by 4.3.3.2"); print the factor. Gypsum face gate reuses `maxHoverB` `:522` unchanged.
- Distribution within the wall (and across a line, Decision D): proportional to design capacity → `V_i = V·b_i f_i / Σ(b_j f_j)`, `v_i = V_i / b_i = v_eff·f_i` with `v_eff = V / Σ(b_j f_j)`. The capacity check per segment `v_i ≤ f_i·v_ASD` reduces to **`v_eff ≤ v_ASD`** for every segment, so the sheathing row demand is `v_eff = V/Σb_eff` — and `Σb_eff` is exactly today's `sumBi()` `:163-175` (h/b > 3.5 is an error before it gets there). No C_o, no A_o, no r.
- Story forces: `storyForces` per wall id as today; per segment `V_i,j = V_j·share_i,j` (share from that level's own geometry). Overturning per segment `M_i,k = Σ_{j≤k} 0.6/0.7·P_j·share_i,j·z_{j,k}` (force-based accumulation, §4.3.6.4.4), `T_i,k = max(0, (M_i,k − 0.6·M_R,i,k)/b_i,k)`, both ends, both directions; `M_R,i` = `w·b_i²/2` (uniform) + `P_end·b_i` on **segment 1, End 1 only**; `C_i = M_i,k/b_i,k + grav` as in `:601-605`. Hold-down picked per segment end (max T governs the row; detail lists every segment). End-post check per segment on the max C. Sill row demand = `max v_i`. **No uniform-uplift row and no combined row** (§4.3.6.4.2.1 is perforated-only; the segmented anchorage is the hold-down at each segment end, §4.3.6.4.2).
- Stacking: a segmented wall must have the **same segment count** on every level where it exists (segment i above lands on segment i below); widths may differ (warning printed with the two widths). Different counts → validation error naming the copy-down button.
- Perforated-only validations skipped for segmented: h ≤ 20 ft `:378`; 2,435 plf cap `:555-560`; "segment at each end" assumption text `:467`. Face 1 must still be WSP `:418` (A.15/B.22 basis). Collector note `:743` reworded ("v_i into each segment").
- Worked case (SW56): h 10 ft, segments [8, 8, 4], W = 8,000 lb strength → V = 4,800 lb; f = 1, 1, 0.8; Σb_eff = 19.2 ft; v_eff = **250.0 plf**; V_i = 2,000 / 2,000 / 800 lb; v_3 = **200 plf**; T_1 = 2,000·10/8 = **2,500 lb**, T_3 = 800·10/4 = **2,000 lb** (no dead load). SW57: segments [8, 2.5] at h 10 → h/b = 4 → refused. SW58: WoodWorks CASE2 (already in the engine `:1221-1227`) run as `method:'segmented'`: v = 0.7·12,989/29 = **313.5 plf** at the roof, base M_OT matches Table 8 (1,502.75 ft-k) within 0.3 %.

Engine touch-points: `validate` `:374-438` (branch on method); `computeWall` `:507-745` split into `computeGeometry()` (perforated: `:508-523`; segmented: `sumBi` + per-segment shares), `computeForces()` (`:580-617`, per segment for segmented), and the existing hardware/check assembly; `out.method`, `out.segmentsRes[]` added. Page: new `Method` column after `L (ft)` (`:618`), openings/unsheathed/uplift cells greyed with title text when segmented; `wallHtml` cards `:957-964` show `Σb_eff` and `v_eff` instead of `C_o`; a per-segment table (b_i, h/b, f_i, V_i, v_i, T_1, T_2, HD, C, post D/C) between the case table and the checks; `detailHtml('sheathing'|'holdown')` get segmented branches. Print: the new table is inside `.inline-res`, already printed. `expandWall` `:736-742` unchanged (≤ 6 rows).

### D. Wall lines with several walls, equal-rigidity proportioning

**Recommendation: option (i) — `wall.line` group key, no `floor.lines[]`.** Walls keep `id` stacking, the adapter stays at version 2, old files load unchanged (`line` absent → `line = id`).

- `lineKey(w) = w.line || w.id`. Walls with the same `lineKey` on one floor share the line force.
- **Line force** at level j = the first wall of the line at level j with a finite `P_*` (src `wall`), else the level force (src `level`). Every wall in a line carries the **same** `P_*` (the page keeps them in sync; validation error if two walls of one line at one level carry different finite values, tolerance 1 lb). This keeps `P_*` where imports and the existing SW44–SW47 fixtures put it.
- **Share** `s_i = cap_i / Σ cap` over the line's walls at that level, `cap_i` = design capacity from geometry only: perforated `C_o·Σb_i`, segmented `Σb_eff`. With identical construction and opening-free full-height walls this equals length proportioning (`cap = L`), which is Nick's stated basis; where C_o or aspect-ratio factors differ it follows SDPWS §4.3.5.5.1 Exc. 1 (capacity-proportional) and yields **equal unit shear across the line** — the "same rigidity, same unit shear" assumption expressed exactly. Plain-L proportioning would give different v_max on two perforated walls of the same line, which contradicts the equal-rigidity premise (open question 5).
- `storyForces` `:211-230` gains a `shareOf(j)` callback; rows carry `share` and `src:'line'` when share < 1; the effective `P_i,j = P_line,j × s_i,j`. Everything downstream (`vmax`, `M`, `T`, `C`) is untouched.
- Construction "global per line": **stored on each wall, kept in sync by the page** (`updWall` fans construction fields — `sheathing`, `endPost`, `holdown`, `sill`, `sillSpecies`, `uplift`, `method` — to every wall with the same `lineKey` on that floor). No `linked` flag: the line key is the link, the engine never needs to know, old files and fixtures keep the flat per-wall shape, and a user who wants one wall different can still split it off by clearing `line`. Storing construction once per line would touch every consumer (engine, adapter, fixtures, copy-down, print).
- Page: a `+ Wall on this line` button in the row (next to ✕): clones the wall (`newWallFrom`), `id = base.id + '#' + n` (unique per stack, e.g. `X@15#2`), `label = base.label + '-2'`, `line = lineKey(base)`, same `P_*`, `L_ft` prompt-free (user edits). The row shows a chip "line A1 · 2 walls · share 40 %". The floor header Σ (`lineSumHTML` `:751-759`) sums **once per distinct `lineKey`** (level P vs Σ lines).
- Continuity: unchanged (by wall `id`); a `#2` wall that exists on the roof only is a wall that starts part way down — already accepted.
- `LH.toShearwallState`: **unchanged** (one line → one wall; `line` absent = own line). `test:lat` unchanged.
- **Diaphragm Designer: no change.** It delivers a per-line force (`rect-diaphragm.js:27-59`); its `len` only feeds the display unit shear `:62`. The split into walls happens in the shearwall calc. State this in the page callout `:293-298` and in the diaphragm results note `:295`.
- Worked case (SW59): line "A1", walls 20 ft + 30 ft, opening-free, one level h 10 ft, `P_wind_lb = 10,000/0.6` on both walls so the ASD line shear is V = 10,000 lb: v = 10,000/50 = **200 plf** on both walls, V_i = **4,000 / 6,000 lb** (shares 0.4 / 0.6). SW60: two perforated walls with different C_o on one line → equal `vmax`, shares = C_o·Σb_i ratio. SW61: differing `P_*` inside a line → refused.

### E. "Copy wall geometry from above to the walls below"

Page-only. Button in the floor header (`:604-612`, not on the base floor): `⇩ Copy walls to levels below`. `copyWallsDown(fi)`:
- for every wall `w` on floor `fi`, for every floor `f > fi`: find the wall with `w.id`; if missing, create it with `newWallFrom(w, w.id)` (which already blanks `dead`, `transfer`, `P_*`) and push it.
- copy: `L_ft, segments_ft, openings, unsheathed_ft2, method, line, sheathing, endPost, holdown, sillSpecies, uplift` (deep-cloned) and `label`.
- **sill rule:** `sill` is copied only to non-base floors; on the base floor the existing `sill` is kept (or `{conn:'ab58', spacing_in:20}` if the wall was just created), `holdown` forced `'hdue'`, and `uplift` copied with `penetration_in` reset to the target floor's default via `SW.penetrationDefault(sc, isBase)` (i.e. cleared to `null`, which the engine reads as that floor's default — no subfloor at the base) and `washer_in` kept (anchor-bolt form). Never copies an above-base connector onto the foundation (`validate` `:428-429` would refuse it anyway).
- leave alone on every lower floor: `h_ft` (floor), `P_wind_lb`, `P_seis_lb`, `dead`, `transfer`, `dir`, `loc_ft`, `sign`.
- No `confirm()` (harness dismisses dialogs `:28`). Message in `#modelMsgs`: "Copied N walls from <level> to M walls on K levels below (X created). [Undo]" — `Undo` restores a `JSON` snapshot of `state.floors` taken before the copy (one step, in memory, cleared on the next render-changing action). `wCnt` bumped for created walls.

### F. Full-width toggle for the Diaphragm Designer and Stacked Headers & Studs

**Recommendation: option (ii) — one button in the shared toolbar.**
- `are-utils-v2.js`: in `injectToolbar()` `:117-124` append `<button class="are-btn" id="areWideBtn" onclick="AREv2.toggleWide()" title="Use the whole browser width (remembered for this calculator)">&#9974; Wide</button>` after Collapse; hidden when `themeOptedOut()` `:62-65` (the theme rule is what makes it work). `AREv2.setWide(on)` toggles `body.are-wide` and the button text (`⬜ Wide ✓` / `⛶ Wide`); `AREv2.toggleWide()` stores `localStorage['areCalcs_wide:' + basename(location.pathname)]`. Per-calc key, **not** one global key: a 58-column wall table wants wide, a one-column anchor calc does not, and Nick would otherwise flip every page at once.
- **Default:** `data-are-wide-default` on the `are-utils-v2.js` script tag (same precedent as `data-no-theme`) — set on `stacked_shearwall_calculator.html:1238`, `stacked_headers_studs_calculator.html:1389`, `rectangular_diaphragm_calculator.html:1194`. Everywhere else default off. Stored value wins over the default.
- Apply in `init()` `:1922-1927` right after `injectTheme()` so the class is on `<body>` before first paint of the toolbar.
- Shearwall migration: delete `#wideBtn` `:277` and `:518-533`; one line at the top of the page script seeds the new key from `areCalcs_sw_wide` when the new key is absent, then removes the old key.
- Print: unaffected (`.are-bar` hidden `:339`; all three pages force the container to 100 % in print). `verify-toolbar.mjs` assertions `:60-75` unaffected (still one bar); add one line to its `evaluate` — `wideBtn: !!document.getElementById('areWideBtn')` — reported, not asserted, so `data-no-theme` calcs still pass. 58/58 stays.
- Harness: `tools/test-stacked-shearwall.mjs:112-123` → click `#areWideBtn`, key `areCalcs_wide:stacked_shearwall_calculator.html`, default on; add the same 6-line block to `tools/test-stacked-headers.mjs` and `tools/test-rect-diaphragm.mjs` (default on, cap `none` → `1280px` → `none`).

## Data-model deltas

Wall, before (v2 today):
```json
{ "id": "X@15", "label": "A2", "L_ft": 40, "h_ft": 10, "segments_ft": [32], "openings": [{"w_ft": 8, "hc_ft": 7}], "unsheathed_ft2": 0,
  "sheathing": {"face1": {"type":"wsp","thickness":"7/16","nail":"8d common","spacing":6}, "face2": null, "blocked": true, "insideFaceHoldown": false},
  "endPost": {"n": 2, "size": "2x6"}, "holdown": "hdue",
  "sill": {"conn": "sds14", "spacing_in": 12, "sheathing": "none"}, "sillSpecies": "DFL",
  "dead": {"w_plf": 0, "P_end_lb": 0, "source": "manual"},
  "uplift": {"capacity_plf": null, "label": ""},
  "transfer": false, "P_wind_lb": 5471, "P_seis_lb": 0, "dir": "X", "loc_ft": 15 }
```
Wall, after (new keys marked; every one is optional and defaulted by `SW.normalizeWall`):
```json
{ "...": "unchanged keys as above",
  "method": "perforated",                                  // NEW (C)  'perforated' | 'segmented'
  "line": "X@15",                                          // NEW (D)  group key; absent = own line (= id)
  "sill": {"conn": "sds14", "spacing_in": 12, "sheathing": "none"},   // unchanged; 'conn' may now be 10d/8d/16dbox/10dbox/8dbox (A/B)
  "uplift": { "source": "sill",                            // NEW (B)  'sill' | 'manual'
              "penetration_in": null,                      // NEW (B)  nails / SDS; null = the printed default (L − 1½" − ¾" subfloor above the base, L − 1½" at the base)
              "washer_in": 3,                              // NEW (B)  anchor bolts: square plate-washer side, in (SDPWS §4.3.6.4.3 minimum 3)
              "capacity_plf": null, "label": "" } }        // kept — manual override
```
Old file → normalized: `uplift:{capacity_plf:500,label:'x'}` → `{source:'manual', capacity_plf:500, label:'x', penetration_in:null, washer_in:3}`; `uplift:{capacity_plf:null}` → `{source:'sill', penetration_in:null, washer_in:3, …}` (computes at the printed default — "default … verify"). `method` absent → `'perforated'`; `line` absent → own line.

Floor and top-level: **no change**. `allowedKeys ['version','floors','wCnt','lateral']` `:1257` untouched (all new keys sit under `floors[].walls[]`, depth > 0). Adapter `version: 2` untouched. `maxStringLength 120` / `stringPattern` satisfied by every new string value. Headers calc and diaphragm: no model change (F is browser-local `localStorage` only, never in the saved file).

Engine result deltas: `out.method`, `out.uplift = {plf, perFastener, W, p, CD, basis, source, errors}`, `out.combined = {Zalpha, alpha, demand, capacity, dc}` (perforated), `out.segments[]` (segmented: `{b, hOverB, f, share, V, v, M, ends[], T, C, holdown, endPost}`), `out.line = {key, walls:n, share}`, `cases[k].rows[].share / src:'line'`. `ENGINE.version` stays 2 (state shape is backward compatible); `ENGINE.rev` string added for the print footer.

## Phased task list

Each phase: files → functions → acceptance → gate. Gate = `npm run test:sw` (and the listed extras) green, then a Fable spec-conformance review against this section and a Fable code review of the diff, before the next phase starts. Commit per phase via `/tmp/are-git` (never git inside OneDrive); deploy only on Nick's go.

### Phase F — toolbar Wide toggle
Files: `public/are-utils-v2.js` (`injectToolbar` `:107-149`, new `AREv2.setWide/toggleWide`, `init` `:1922-1927`), `public/Calcs/stacked_shearwall_calculator.html` (`:277`, `:518-533` removed; script tag `:1238` + migration line), `stacked_headers_studs_calculator.html:1389`, `rectangular_diaphragm_calculator.html:1194`, `tools/verify-toolbar.mjs:60-68`, `tools/test-stacked-shearwall.mjs:112-123`, `tools/test-stacked-headers.mjs`, `tools/test-rect-diaphragm.mjs`.
Acceptance: three calcs open wide by default, toggle persists per calc, other calcs default narrow, `qa:toolbar` 58/58, `test:sw` / `test:hdr` / `test:dia` green, print unchanged (screenshot in `tools/_out/`).
Gate: spec review (this section F) + code review.

### Phase A — SPF / SP values
Files: engine `SPECIES` (no change), `HOLDOWNS` `:109-116` (`bySpecies` slot), `holdownCapacity` `:119-127` (species arg), `SILL_CONN` `:139-153` (`ltp4`, `16d` → `bySillSpecies`, new nail rows from B's `NAILS` table may land here already), `validate` `:432-437` (HDUE+SPF, LTP4+SPF errors), `computeWall` `:671-673` (min-G rule for nails), page `:348`, `renderRefTables` `:1150-1157`; fixtures SW48–SW50.
Acceptance: SW48 16d SPF sill → 192 lb / 144 plf @ 16 in; SW49 HDUE + SPF refused with the ESR-2330 §3.2.2 message; SW50 LTP4 + SPF refused; DFL/SP models byte-identical to today except 16d on SP (226 → 246). NEEDS-SOURCE #1/#2 listed in the page note until Nick supplies the catalog pages, then filled in the same slots with a follow-up commit.
Gate: spec + code review; `test:sw` green.

### Phase B — automatic uplift capacity + combined check
Files: engine — new `NAILS`, `upliftCapacity()`, `combinedCheck()`, `normalizeWall()`; `computeWall` `:670-695` and check rows `:698-740`; `defaultWall` `:772`; `validate` (6D, blank inputs → no error, just "specify"); page — column `:633/:671`, `updWall` `:494-497`, `wallHtml` `:1006-1007`, `detailHtml` `:1091-1098` + new `combined` branch, `expandWall` (6 rows OK), ref table; adapter `setModel` `:1277` and `importProject` `:1186` call `SW.normalizeWall` per wall; harness `:75-76` (still 22 columns — the uplift cell changes content, not count), `:103`, SW40 text; fixtures SW51–SW55.
Acceptance: worked numbers in Decision B reproduced to 0.1 lb; old file with typed plf loads as `manual` and prints the same D/C as before; blank penetration → amber "Specify" banner (existing `sum-req` styling); combined row appears only for nails/SDS on perforated walls.
Gate: spec + code review; `test:sw` green; `qa:roundtrip`/`qa:adversarial` on the shearwall file.

### Phase C — segmented method
Files: engine `validate` `:374-438`, `computeWall` `:502-745` (geometry/forces split), fixtures SW56–SW58 (+ CASE2 rerun); page `Method` column, cell greying, per-segment results table, `detailHtml` branches, callout `:293-298`, notes `:346`; harness column count (23, `colspan="23"`), a segmented UI check (method select → per-segment table rows = segment count, no uplift row).
Acceptance: SW56 v_eff 250 / v_3 200 / T 2,500 & 2,000; SW57 h/b 4 refused; SW58 WoodWorks v 313.5 plf, M_OT within 0.3 %; every perforated fixture SW1–SW55 unchanged.
Gate: spec + code review (this is the largest engine change — reviewer to re-derive SW56 by hand).

### Phase D — wall lines
Files: engine `lineKey()`, `wallShare()`, `storyForces` `:211-230` (`shareOf`), line-force resolution + equal-P validation, `res.notes` line; page `+ Wall on this line`, chip, `updWall` fan-out, `lineSumHTML` `:751-759` per line; fixtures SW59–SW61; harness: split → two rows, Σ chip once per line, fan-out of a sheathing change.
Acceptance: SW59 200 / 4,000 / 6,000; SW60 equal v_max; SW61 refused; import of the Red Bluff files unchanged (`test:lat` untouched, `test:sw` import checks `:409-424` unchanged).
Gate: spec + code review.

### Phase E — copy-down
Files: page only (`copyWallsDown`, undo, floor header button `:604-612`); harness: copy from the roof on a 4-level model → lower walls match on the key list, base sill still `ab58/20`, `P_*`/`dead`/`h_ft` untouched, undo restores the JSON exactly.
Acceptance: as listed; no dialogs.
Gate: code review only (no engine change); spec review folded into D's if shipped together.

Order rationale: F is shared-file but trivial and unblocks the wide tables Nick will stare at while reviewing C/D; A is data plus two refusals; B adds rows to the existing perforated path; C introduces the method branch that D's share function needs (`cap_i` differs by method); E copies `method` and `line`, so it goes last. E could ship right after C if Nick wants it sooner (copy `line` is a no-op then).

## Test plan

Engine fixtures (inside `FIXTURES`, run by `SW.runFixtures()` and `npm run test:sw`):

| ID | Case | Hand value |
|---|---|---|
| SW48 | 16d sill, sill species SPF (framing DFL) | Vconn 192 lb (min G), 144.0 plf @ 16 in |
| SW49 | HDUE on SPF framing | refused, message names ESR-2330 §3.2.2 |
| SW50 | LTP4 on SPF | refused, message names C-C-2026 SPF/HF row |
| SW51 | 16d uplift, DFL, p 2.0, 16 in | 128 lb, 96.0 plf; SPF 62.4; SP 120.0 |
| SW52 | SDS ¼×4½ uplift, DFL p 3.0 → thread 2.75, 12 in | 756.8 plf; SPF 532.4 |
| SW53 | Combined 16d DFL @ 16 | Z'_45 163.4 lb; allowable v_max 86.7 plf; row governs over shear 169.5 and uplift 96.0 |
| SW54 | Anchor bolt T_allow 2,000 @ 20 | 1,200 plf; no combined row |
| SW55 | 16d p 0.9 (< 6D 0.972) | refused; old-file `{capacity_plf:500}` → manual 500 plf, same D/C as SW40 |
| SW56 | Segmented [8,8,4], h 10, W 8,000 | Σb_eff 19.2; v_eff 250.0; V_i 2,000/2,000/800; v_3 200; T_1 2,500; T_3 2,000; no uplift row |
| SW57 | Segmented [8,2.5], h 10 | refused (h/b 4 > 3.5) |
| SW58 | CASE2 WoodWorks as segmented | roof v 313.5 plf; base M_OT 1,502.75 ft-k ± 0.3 % |
| SW59 | Line A1: 20 + 30 ft, P_wind 10,000/0.6 | v 200 plf; V 4,000 / 6,000 |
| SW60 | Two perforated walls, one line, C_o 0.6 vs 1.0 | equal vmax; shares by C_o·Σb_i |
| SW61 | Line walls with different finite P_wind | refused |
| SW62 | Segmented wall, 3 segments above / 2 below | refused, message names copy-down |

Harness (`tools/test-stacked-shearwall.mjs`) additions: column count 23 after Phase C; uplift source select + penetration cell; `#areWideBtn` block; segmented UI (per-segment rows, no uplift/combined rows); split line (two rows, chip, Σ once per line, fan-out); copy-down + undo; print screenshot of a segmented + split model. `tools/test-stacked-headers.mjs`, `tools/test-rect-diaphragm.mjs`: wide-toggle block. `tools/verify-toolbar.mjs`: report `wideBtn`. `npm run test:lat`: unchanged and must stay green after D. `npm run qa:toolbar` after F.

Commands per phase: `npm run test:sw`; F also `npm run qa:toolbar && npm run test:hdr && npm run test:dia`; D also `npm run test:lat`; B and later also `npm run qa:roundtrip -- stacked_shearwall_calculator.html` (or the tool's file filter) and `npm run qa:adversarial`.

## Open questions for Nick

1. **HDUE and LTP4 on SPF (NEEDS-SOURCE).** ESR-2330 §3.2.2 and ESR-2105 fn. 2 cover G ≥ 0.50 only, so under the pinned sources SPF framing has no hold-down and no LTP4. The Simpson C-C-2026 catalog publishes SPF/HF columns for both, but the catalog is not on disk. Supply those pages (HDUE table SPF/HF column, LTP4 p. 309–310 SPF/HF row) and I add the values in the slots Phase A leaves; otherwise Phase A ships the refusals.
2. **SDS withdrawal on SPF.** ESR-2236 Table 5 tabulates 172 lb/in for G ≥ 0.50 only; §4.1.3 says to derive W per NDS wood-screw provisions (No. 14) → Table 12.2B gives 121 lb/in at G 0.42. Use that derivation, or restrict SDS uplift to DF/SP?
3. **Combined shear + uplift (NDS §12.4).** Apply Eq. 12.4-1/12.4-2 as a third check row (recommended — it governs the 16d example at 86.7 plf vs 96.0), or print it as an advisory note only?
4. **Anchor-bolt uplift input.** Allowable tension per bolt (lb) typed by you → plf = T/(s/12), with the §4.3.6.4.3 washer note (recommended), or leave base-level uplift as a manual plf?
5. **Line share basis.** Design capacity (C_o·Σb_i perforated / Σb_eff segmented — equal unit shear on the line; equals length for opening-free walls) as recommended, or plain wall length L even when C_o differs between the walls on a line?
6. **Segmented stacking.** Require the same segment count on every level of a segmented wall (widths may differ, warning printed) — acceptable? The alternative (arbitrary re-mapping of segments floor to floor) needs a transfer model this calc does not have.

Resolved without asking: the 2b/h factor is the same text in SDPWS 2015 and 2021 and applies to wind and seismic alike (F7); toe-nails out of scope; SPF-S not added.

---

## Nick's decisions (2026-09-16) — LOCKED, override any earlier text

1. **HDUE / LTP4 SPF-HF values:** Simpson catalog on disk at `C:\Users\nickh\OneDrive - Rohr Engineering\Technical Resources - Documents\Wood\Wood Codes and Technical Guides\Simpson\C-C-2026.pdf`. Phase A pins the SPF/HF column for every `HOLDOWNS` row (all thickness steps) and the LTP4 SPF/HF row from it, with page numbers. No refusal for SPF once pinned; a model whose species has no value for a given connector still refuses with the message in Decision A. ESR values previously read from the web are to be re-cited to the catalog pages where the catalog carries them; where only an ESR carries a number, cite the ESR and say "not on disk".
2. **SDS on SPF:** yes — NDS Table 12.2B No. 14 wood-screw withdrawal (121 lb/in at G 0.42; 172 at 0.50; 208 at 0.55), as ESR-2236 §4.1.3 directs. Also read the catalog SDS withdrawal table and note any difference.
3. **Combined shear + uplift (NDS §12.4):** yes — a real check row (nails Eq. 12.4-2, SDS Eq. 12.4-1), not a note.
4. **Anchor-bolt uplift:** the calc REPORTS the required tension per bolt, `T_req = t × s / 12`, as a demand line "verify anchor rod / concrete for T_req" — no concrete capacity is entered. The wood-side check the calc performs itself: **plate-washer bearing on the sill**, capacity = F_c⊥(sill species, NDS Supplement Table 4A/4B — DFL 625, SP 565, SPF 425 psi; no C_D on F_c⊥) × net washer area (washer size input, default 0.229 × 3 × 3 in per SDPWS §4.3.6.4.3, hole = bolt D + 1/16 in) vs `T_req`. Row label "Sill plate washer bearing (uplift)"; pass/fail on that; `T_req` printed beside it for the concrete check. No typed `T_allow_lb`.
5. **Line share:** by design capacity (Decision D as written).
6. **Segmented stacking:** same segment count on every floor the wall exists; widths may differ (warning); otherwise an error naming the copy-down button.

Implementation order stays F → A → B → C → D → E. Each phase: implementer subagent, then a Fable spec-compliance review and a Fable code-quality review before the next phase starts; nothing pushed until Nick says deploy.

---

## Phase B as-built (2026-09-16, commits 162af17 + follow-up)

Deviations from Decision B, all confirmed at review:
- **SDS head pull-through cap.** C-C-2026 p. 377 note 5 caps withdrawal through a wood side plate at 345 lb DF/SP / 240 lb SPF/HF (C_D 1.0; W_H takes C_D per NDS Table 11.3.1). Applied by SILL species, so SDS ¼×4½ on a DF/SP plate is 552.0 lb (not 756.8) and the combined row gives Z'_45 = 463.9 lb → v_max ≤ 328.0 plf @ 12 in. Note 4 of the same page uses 172 / 121 lb/in, agreeing with NDS Table 12.2B; the catalog has no separate SP column, so SP reads 208 from the NDS as LOCKED item 2 directs. The 250 / 190 lb sole-to-rim shear values were not located in C-C-2026 (p. 377 gives 350 / 250 lb for a 1½ in wood side plate at C_D 1.0); the basis now cites the September 2026 QAQC appendix C §6.
- **Penetration default with a subfloor.** Above the base `p = L − 1½" − ¾"`; at the base `p = L − 1½"` (`SW.penetrationDefault(sc, isBase)`). `penetration_in: null` means "use the default"; the row prints "p = … in (default: … — verify)" or "(entered)". The same p drives Table 12N fn. 3 (Z × p/10D under 10D) on the nail shear row, which prints p. Consequences at the defaults: 16d common above the base 80 lb / 60.0 plf @ 16 with shear 174.4 lb; 8d / 10d common and box, and 8d box, fall under 6D and are refused until a penetration is entered. A nail through plate + subfloor into the rim is disclosed as not the two-member Table 12N case.
- **6D gates.** Nails NDS §12.1.6.4; wood screws §12.1.5.6 (SDS 6D = 1.452 in). SDS under full thread gets a sill note (C-C-2026 p. 377 note 2).
- **Anchor bolts.** No `T_allow_lb`; `washer_in` (default 3) and the sill plate-washer bearing row F_c⊥ × A_net (round hole D + 1/16; slotted washer ≈ 10 % less; C_b not applied); T_req = t × s/12 per bolt is printed under either uplift source.
- Check rows are selected by id everywhere (`uplift`, `combined`); Phase C removes them on segmented walls.

## Phase D/E as-built (2026-09-16, commits 9830c31 + 0721bc4; Phase E follow-up)

- **`+ line` label (D).** The row button reads `+ line` (its title carries the planned "+ Wall on this line — …" text); the plan's full label did not fit the ✕ column. Behaviour as planned: `id = base.id + '#' + n` unique over every level, `label = base.label + '-' + n`, same line force, construction fanned along the line by `updWall` (`LINE_FIELDS`).
- **Copy-down (E) as implemented** — `copyWallsDown(fi)`, page only, header button `⇩ Copy walls to levels below` on every level but the base (the engine's segmented count-mismatch error names it):
  - For every wall on level `fi` and every level below: the wall with the same `id` is the target; missing → `newWallFrom(w, w.id)` (blank `dead`, `transfer`, `P_*`), `h_ft` = that level's, pushed at the end, `wCnt` bumped.
  - Copied, deep-cloned (`COPY_FIELDS`): `L_ft, segments_ft, openings, unsheathed_ft2, method, line, label, sheathing, endPost, holdown, sillSpecies, uplift`; `sill` on non-base levels only. A `line` key absent above is removed below (the copy is the line membership).
  - Base: existing `sill` kept (`ab58 @ 20` for a just-created wall); `holdown` `strap` → `hdue` (validate: straps are floor-to-floor only); `uplift.penetration_in` → `null` (= `SW.penetrationDefault(sc, true)`, no subfloor) — a typed penetration never crosses a floor; `uplift.washer_in` kept (it belongs to the base's anchor bolts); `source` / `capacity_plf` copied.
  - Left alone below: floor `h_ft`, `P_wind_lb`, `P_seis_lb`, `dead`, `transfer`, `dir`, `loc_ft`, `sign`.
  - Line consistency: copy-down bypasses `updWall`, so on each level every wall sharing a touched line key that was not itself a target (a base-only mate, for instance) takes `sheathing, endPost, holdown, sillSpecies, uplift, method` (+ `sill` above the base; washer kept at the base) from the copied wall. Geometry, label and dead load of the mate stay.
  - Message in `#modelMsgs`: "Copied N walls from <level> to M walls on K levels below (X created[, Y more on shared lines]). [Undo]". Undo restores `JSON.stringify(state.floors)` and `wCnt` from an in-memory snapshot; `render()` nulls the snapshot, so any model change (or the Undo itself) lapses it. No `confirm()`.
  - Harness block "copy walls to levels below (Phase E)" in `tools/test-stacked-shearwall.mjs` (12 checks): roof edited to segmented [100, 68, 4] / two openings / 10d @ 4 / strap / sill @ 8 / p 2.0 / 3 posts / SP, split `w1` + `w1#2`, 2ND-floor `w1` deleted, base-only mate `w2` on line `w1`; copy → every lower `w1` matches, base `ab58/20` / HDUE / p null / washer kept / dead and P_W kept, 2ND `w1` recreated blank, `w1#2` on every level, mate takes the construction, no error, Undo exact and one-step, no dialogs.
