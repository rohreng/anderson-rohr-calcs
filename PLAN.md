# Plan: Server-free saved calculations + print standardization across all 55 calcs
_Locked via grill — by Claude + Nick Rohr, 2026-08-15. **Rev. 7** after Codex rounds 1–5 (MAX_ROUNDS) + Fable plan verification._

## Goal

Make every calculator on calcs.andersonrohr.com produce a **single self-contained `.html` file** that an
engineer saves directly into the project folder on OneDrive. That one file is simultaneously (a) the
readable, printable calculation record — full results, opens offline, no network — and (b) the reloadable
input set: any other engineer, on any other machine, in any later session, opens the calculator and loads
that file to recover the exact inputs and re-run. Additionally, bring the seven calculators that lack the
standard ARE toolbar — including the Deep Beam Strut-and-Tie (Wall on Piers) calculator — up to the same
Save / Summary-print / Full-Calc-print standard as the other 48, and prove the round-trip on all 55 with an
automated harness rather than asserting it.

No database, no hosted storage, no new server. OneDrive is the sharing layer; the browser is the transport.

## Authoritative coverage manifest

Rev. 1 asserted a gap list from notes and got it wrong. Rev. 2's replacement CSV was itself malformed —
nine header columns against eight data columns. The manifest at `tools/calc-coverage.csv` is now derived
from the files and **validated**: 9 columns, 55 rows, zero column-count mismatches, zero duplicate
filenames. The QA harness re-derives it and fails on drift or schema violation.

- **55 calcs in scope** (`public/Calcs/*.html` less `steel-calc-template-eval-review.html`, a skill-eval
  artifact absent from the `CALCS` registry).
- **7 toolbar gaps** — `brace_connection_at_column_on_beam`, `composite_stud_blockout`, `deep_beam_stm`,
  `embed_plate_beam_bearing`, `hss_column_bearing_on_beam`, `hss_hanger_tension_connection`,
  `wri_stiffened_slab`.
- **2 of those on `are-calc.css`** — `deep_beam_stm`, `hss_hanger_tension_connection`.
- **11 calcs flagged `dyn_rows`**; **19 flagged with id-less `input`/`select`/`textarea`**.
- **Both flags are heuristics and both are wrong in places** *(Rev. 7)*. `dyn_rows` cannot distinguish
  input-bearing growth from results-table growth, so it produced two false positives
  (`channel_joist_bearing`, `masonry_anchor`) and missed `column_base_plate_v3` entirely, whose inputs are
  rebuilt by `buildTable()` from string-concatenated `<td><input …>`. `idless_inputs` counts `<input`
  occurrences inside JS template literals, so `4_story_shear_wall` scores 4 while its static HTML has zero
  and its *runtime* DOM has 16 JS-built id-less controls. **The manifest is authoritative for coverage —
  which file carries which script — not for classification.** Tier assignment comes from reading each
  file; the harness's re-derivation catches drift, not misclassification.
- **1 textarea site-wide**; **0 `<canvas>`** — all drawings are SVG from `are-draw.js`, no external images.

## Current state (measured)

- `are-utils-v2.js` injects a Save/Load toolbar whose `areSave()` writes to **`localStorage`** under
  `are_v1_<filename>` — one slot, per browser, per machine. That is the reported defect.
- That save is also **incomplete**: it selects `input[id], select[id], textarea[id]`, silently dropping
  every point load, partial load and hole on `web_opening_calculator.html`.
- `/api/calc/*` is **live production**, consumed by pyRevit `SendToCalc`
  (`revit/.../SendToCalc.pushbutton/script.py:975`). Untouched by this plan.
- `wri_stiffened_slab_calculator.html` loads `/are-utils.js` at line 751 **and** carries a second complete
  inline v1 implementation from line 763.
- `public/Calcs/are-calc.css` lines 11 and 17 carry **two external `@import url(...)`** rules (Google
  Fonts, fonts.cdnfonts.com) — these survive a naive `cssRules` read and would make snapshots hit the
  network.

## Approach

### 1. Two-tier state model

The Rev. 1 universal heuristic is abandoned: `stacked_headers_studs` calls `addHeader(fi)`/`addStudRow(fi)`
with a floor index from inside `render()` (lines 855, 885, 1021, 1127), `web_opening`'s add buttons sit
outside the `<tbody>` elements that grow (lines 320–381), and count-replay cannot reproduce a deletion.

- **Tier A — static calcs.** Captured by key: `#id` → `name[i]` → structural DOM path from the nearest
  ancestor with an `id`. All selector components pass through `CSS.escape`. Capture **fails closed** if a
  key resolves to zero or multiple elements.

- **Tier B — model-driven calcs. Twelve adapters, not thirteen, and a different set** *(corrected in
  Rev. 7)*. The manifest's `dyn_rows` flag cannot tell input-bearing growth from results-table growth, so
  the Rev. 6 list was wrong in three places:

  | Group | Calcs | Notes |
  |---|---|---|
  | Real JS model — cheap | `stacked_headers_studs` (`floors`+`LV`), `stacked_shearwall`, `snow_load` (`configurations`), `asce_irregularity` (`stories`), `web_opening` (`holes`/`ploads`/`partialLoads`) | `stacked_shearwall` already has `exportProject`/`importProject` JSON at 969–1020 — the adapter is nearly free. `snow_load` has a hidden `#configData` JSON bridge input that the adapter must own or Tier A will double-capture it. |
  | DOM-held state — moderate | `asce716_mwfrs`, `steel_joist_selector`, `rectangular_diaphragm`, `headers_gradebeam_pier` | `headers_gradebeam_pier` is the hardest in the project: its tables exist only after the user clicks **Generate Tables** (`:348`, guard `:795`), so `setModel` must replay a workflow, not just apply data. |
  | React | `directly_welded_HSS`, `hss_connection_complete` | Flat `useState`; adapter inside the component. Plus the override removal in §4. |
  | **Added** | `column_base_plate_v3` | Was misclassified as static Tier A. `loadExcel()` (`:827`) sets `MBR=parsed` (`:841`) and `buildTable()` regenerates inputs with member-derived ids `fPu_<mid>` / `ssec_<mid>` (`:293,:323`). A save made after a RISA upload captures ids absent from a fresh page, so the fail-closed gate would reject it — **permanently unloadable** without re-uploading the same workbook first. |
  | **Removed** | `channel_joist_bearing`, `masonry_anchor` | False positives. Their `innerHTML +=` growth is results/check tables only (`channel_joist:795`, `masonry_anchor:1319`); all inputs are static and id'd (`masonry_anchor:1269 INPUT_IDS`). Tier A covers them. |

  Each adapter exposes:

  ```js
  window.areAdapter = {
    version: 1,
    ownedFields: ['#floorsWrap'],        // subtrees the model owns — see below
    schema:      { /* allowed keys, types, ranges, max depth, max nodes */ },
    ready:       Promise<void>,          // resolves when async data has landed
    getModel()   { return structuredClone(FLOORS); },
    setModel(m)  { FLOORS = m; render(); },
    runAndSettle() { return runCalcsAndSettle(); }   // resolves after final mutation
  };
  ```

- **Tier A / Tier B boundary is explicit** *(new in Rev. 3)*. Each adapter declares `ownedFields`.
  Controls inside those subtrees are **excluded from generic capture and from both directions of the
  mismatch diff** — the model is the sole authority for them. Rev. 2 left this ambiguous and would have
  double-stored state and rejected valid model-driven pages.

- **React state is restored through the component, not the DOM** *(changed in Rev. 3)*. For
  `directly_welded_HSS` and `hss_connection_complete` the adapter is defined **inside** the React app and
  closes over its state setters. Rev. 2's native-value-setter language is removed: driving DOM inputs does
  not reliably update hook state, and the component owns the truth.

- **Shared predicate.** One `isPersistableField(el)` used by capture, lookup and both diff directions.
  Excludes `areJob`, `type="file"`, disabled and readonly controls, `.are-bar` and hub chrome, the
  snapshot's own print-mode radios, and anything inside an adapter's `ownedFields`.

- **Readiness — seven calcs, all needing new instrumentation** *(corrected in Rev. 7)*. The six
  SheetJS/workbook calcs **plus `web_stiffener`**, which fetches `/data/aisc-shapes-v16.json` and gates on
  a `DB_LOADED` flag (`:225–231,:299`) while populating `#sec` asynchronously — a Tier-A calc whose select
  cannot be restored before the fetch lands. **None of the seven exposes any promise or event today**, so
  `ready` is new instrumentation in every one of them, and that belongs in the estimate beside the
  adapters. Save is disabled until `ready` resolves.

- **Settling — time-based, not frame-based** *(corrected in Rev. 7)*. Two quiet animation frames (~33 ms)
  is shorter than the real redraw timers in this codebase: `channel_joist_bearing:1066` retries on a
  **250 ms** `setTimeout`, `masonry_anchor:1840` uses 80 ms, `snow_load:2269` schedules at 50 ms. The
  frame-based gate would pass and *then* the DOM would mutate, snapshotting a stale or missing diagram.
  The quiet period is therefore time-based and longer than the longest known timer, or the adapter wraps
  those timers explicitly in `runAndSettle()`.

- **Restore transaction — suppression means "no re-render", not "no handlers"** *(decided in Rev. 7)*.
  `stacked_headers_studs:796` updates `LV[k]` *only inside* the `change` handler that also calls
  `render()`. Blocking handlers wholesale would leave `LV` stale after a Tier-A restore. Two rules:
  model-synchronising inputs are listed in `ownedFields` so the model owns them outright, and suppression
  blocks re-render and recalculation only — handlers that maintain model state still run. `beginRestore()`
  sets the flag, Tier-B models are applied first, then Tier-A fields, `endRestore()` clears it, and exactly
  one `runAndSettle()` executes.

### 2. `AREv2.buildSnapshot(mode)` → `Promise<{ filename, html }>`

Explicitly **async** and **fail-closed** — it returns the list of resources it could not inline and refuses
to emit a half-offline record.

1. Require a non-empty Project field; typed error if empty. Require `adapter.ready`.
2. `await runAndSettle()` plus the mutation-quiet check.
3. **Expand-all before cloning** *(new in Rev. 7 — this was a silent data-loss blocker)*. Some calcs
   **conditionally render** rather than hide: `stacked_headers_studs:1016` guards its per-floor header and
   stud tables with `if(fl.exp){…}`, and `stacked_shearwall` uses the same per-floor/wall `exp` flag. A
   collapsed floor is *not in the DOM at all*, so the sanitize/normalize step — which only reveals hidden
   nodes — cannot recover it, and a record saved with a floor collapsed would be permanently missing that
   floor with no indication. Before cloning, `buildSnapshot()` therefore routes an **expand-all through
   the adapter** (set every `exp` flag true, re-render, re-settle), captures, and restores the engineer's
   original expansion state afterward. Calcs with no adapter and no conditional rendering skip this step.
   The QA harness includes a scenario that deliberately collapses a floor before saving.
4. Deep-clone `document.documentElement`.
5. **Normalize live state into serializable attributes** — `value` attributes for inputs; `textContent`
   for the one textarea; for every `<select>`, strip **all** existing `selected` attributes before setting
   the live one; `checked` attributes from live properties.
6. **Recursive CSS inlining** *(new in Rev. 3)*. Walk `document.styleSheets`, recursing into every
   `CSSImportRule` — `are-calc.css` imports two external font sheets that a flat `cssRules` read would
   preserve. External imports are **removed, not followed**. Original `<link rel="stylesheet">` elements,
   including Google Fonts, are deleted and replaced with a self-contained font stack.
7. **URL audit covers CSS as well as attributes** *(new in Rev. 3)*. After assembly, parse every final
   style block and **fail closed** on any `url()` that is not `data:` or a local SVG fragment such as
   `url(#arrowhead)`. Without this, CSP would silently block resources the reviewer assumed were inlined.
8. Append `are-print-v2` rules plus snapshot rules that **normalize** full/summary visibility in the clone
   — `.det-row`, `.calc-det`, `<details>` forced open — because CSS alone cannot reproduce what
   `arePrint('f')` does imperatively.
9. **Sanitize to inert.** Remove every `<script>`, every `on*` attribute, every `javascript:` URL, and any
   `<iframe>`, `<object>`, `<embed>`. Remove `.are-bar` and hub chrome; **keep** the `.are-ph` ARE print
   header. External `<a href>` citations (FHWA, CTR) are kept as **navigable** links — Rev. 4 called them
   "inert", which was wrong; they still navigate — and are given `rel="noopener noreferrer"`. They are
   retained deliberately: a reference citation that cannot be followed is worth less in the record. Add
   `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">`.
10. **Print-mode toggle with an explicit wrapper** *(corrected in Rev. 3)*. Two radios are inserted as the
   first children of `<body>`, and **all record content is wrapped in `.are-snapshot-content` as their
   following sibling**, so rules reach nested sections:
   `#are-mode-summary:checked ~ .are-snapshot-content .det-row { display: none !important }`.
   General-sibling selectors only — no `:has()`, which a record opened years from now may not have.
11. **JSON embedding, correctly escaped** *(restated literally in Rev. 4)*. Both prior revisions described
    this escape in prose and both came out as no-ops. The rule is exactly this code:

    ```js
    const json = JSON.stringify(envelope)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');
    ```

    Those replacement strings are the literal six characters `\`, `u`, `0`, `0`, `3`, `c` — a JSON unicode
    escape, which `JSON.parse` restores to the original character. A regression test puts the literal
    payload `</script><img src=x onerror=alert(1)>` in the Project field, then asserts the serialized HTML
    contains **no literal `</script`** substring outside the closing tag and that the reloaded document
    has no executable node.
12. **Snapshot versioning** *(corrected in Rev. 4)*. The envelope carries `schema: "are.snapshot.v1"`,
    `adapterVersion`, `calcFile`, `calcSlug`, and `calcRevision` (a content hash of the calc file at save
    time). **`schema` and `adapterVersion` govern rejection; `calcRevision` never does.** Codex was right
    that hard-failing on a content hash would make every saved file unloadable after essentially any
    deploy — which contradicts the entire "any later session" goal. A revision difference raises a
    non-blocking notice ("this calculator has changed since the file was saved") and otherwise proceeds
    into the normal field-mismatch check, which is the mechanism that actually catches incompatibility.
    Breaking changes are handled by bumping `adapterVersion` with an explicit migration or an explicit
    refusal.
13. `filename` = `<Project> - <Calc name> - <YYYY-MM-DD>.html`, sanitized for Windows.

`AREv2.loadFromHtml(htmlString)` parses with `DOMParser`, rejects a mismatched `calcFile`/`calcSlug` or an
unknown `schema`/`adapterVersion`, **validates the Tier-B model against the adapter's declared schema**
— allowed keys, types, numeric ranges, size and depth limits — before it ever reaches `setModel()`, then
diffs Tier-A fields both directions and **populates nothing if any mismatch exists**. Force-apply requires
explicit confirmation.

**Model strings are treated as hostile** *(new in Rev. 4)*. Snapshot sanitization protects the *output*
file; it does nothing for the *input* path, and many of these calcs build rows by string-concatenating
into `innerHTML`. A hand-edited snapshot could therefore inject markup into the live calculator at
`setModel()` time. Two mitigations, both required: adapter schemas constrain every string field by maximum
length and a conservative character allowlist, and any model renderer that currently interpolates model
strings into `innerHTML` is changed to assign via `textContent` or to HTML-escape. The audit of which
renderers do this is part of writing each adapter. The realistic threat is low — it requires a colleague
to hand you a doctored file — but the whole point of the feature is that these files travel between
engineers, so untrusted-input handling is the correct default.

### 3. I/O wrappers

**Ordering is load-bearing** *(new in Rev. 5)*. All picker calls and `requestPermission()` require
**transient user activation**, and activation is consumed by the time an `await` chain returns. Rev. 4's
flow — build the snapshot, then pick a destination — would have thrown `SecurityError` on every save once
`runAndSettle()`, mutation-quieting and CSS inlining had run. The click handler must therefore:

1. **Synchronously**, as its first act, acquire the destination — call `requestPermission()` or
   `showDirectoryPicker()` immediately, before any `await`.
2. *Then* `await buildSnapshot()`.
3. *Then* write through the handle obtained in step 1.

**Nothing the handler needs may be asynchronous** *(new in Rev. 6)*. Two things in Rev. 5 still were:
reading the persisted handle out of IndexedDB, and checking whether `adapter.ready` had resolved. Both
require an `await`, and either would consume the activation before the picker call. So:

- The directory handle and its permission state are **preloaded during page initialization** and cached in
  memory. The click handler reads a plain variable, never IndexedDB.
- Promise resolution is tracked in **explicit boolean flags** — `calcReady` and `destinationReady` — set by
  `.then()` at init, because a promise's settled state cannot be read synchronously.
- **Save stays disabled until both flags are true.** Preflight validation inside the handler is then pure
  synchronous field checks, and the picker is never opened for a save that cannot complete.

Rev. 3 was also wrong about the API itself: **`showSaveFilePicker()` returns a `FileSystemFileHandle` with
no parent-directory traversal**, so a remembered folder and collision probing are both impossible through
it. The corrected design uses two calls:

- **`showDirectoryPicker()`** once — the engineer points at the project's `03 - Calculations` folder. The
  directory handle is stored in IndexedDB and revalidated each session with
  `queryPermission()`/`requestPermission()`, re-prompting cleanly when the grant has lapsed. Saves then go
  through `dirHandle.getFileHandle(name, { create: true })`, and collision probing becomes possible:
  `getFileHandle(name, { create: false })` is attempted for `-r2`, `-r3`, … until it throws
  `NotFoundError`, which is the free name. **This probe is advisory, not overwrite-safe** *(Rev. 5)* —
  check-then-create is a race, and two tabs could pick the same free revision. Documented rather than
  solved: the alternative is a timestamp or random suffix in every filename, which sacrifices the readable
  naming Nick specifically chose for a collision that requires two engineers saving the same calc, for the
  same project, on the same day, in the same instant. Last write wins, as it does for any file on a share.
- **`showSaveFilePicker({ startIn: dirHandle })`** as the "Save as…" path when the engineer wants a
  different location — starting in the remembered folder, but returning only a file handle, so no
  probing is claimed for it.

Anything other than `AbortError` falls back to an anchor download, which auto-renames silently rather than
prompting. The toast always states which of the three paths was actually used.

**localStorage** save/load is removed, with a one-release **"Load last local save"** bridge.

### 4. Toolbar and print coverage

Add `are-utils-v2.js` to the 7 gap calcs, **all seven with `data-no-theme`** — theme injection is opt-in
per calc after a visual check, protecting the freshly signed-off Deep Beam STM calc.

**Legacy-implementation inventory** *(new in Rev. 7 — this is what five rounds of plan review missed)*.
`injectToolbar()` begins `if (document.getElementById('areBar')) return;` (`are-utils-v2.js:71`). Any calc
that builds its own `areBar` first makes v2 a **silent no-op**. Five files carry a complete inline v1
implementation and every one must be stripped, not merely have a script tag added:

| File | v1 bar | v1 `areSave` | v2 tag | Consequence today |
|---|---|---|---|---|
| `embed_plate_beam_bearing` | 1932 | 1983 | — | **Gap fix would have done nothing.** Adding v2 yields no toolbar. |
| `wri_stiffened_slab` | 868 | 919 | — | Same, plus a `/are-utils.js` tag at 751 to remove. |
| `snow_load` | 1496 | 1547 | 1665 | v2 already bails; the visible bar is v1. |
| `asce_irregularity` | 1400 | 1451 | 1568 | Same. |
| `rectangular_diaphragm` | 1243 | 1294 | 1411 | Same. |

The last three already have v2 and were never counted as gaps, but **the new Save UI — the
`calcReady`/`destinationReady` gating, "Save as…", the save-path toast — would not appear on them** until
their inline v1 is removed. They join the migration set: five inline-v1 strips, each needing visual
re-verification.

**React override removal** *(new in Rev. 7)*. `hss_connection_complete:894` and
`directly_welded_HSS:1020` redefine `window.areSave`/`window.areLoad` *after* the v2 tag (lines 884 and
1010), against a `are_v1_react_*` localStorage key. These hijack the new Save and must be removed as part
of writing those two adapters — separate surgery on shipped code, called out here so it lands in the
estimate.

- `composite_stud_blockout` uses none of the `.blk` / `.det-row` / `.calc-det` / `#sumBox` conventions and
  needs bespoke print CSS.
- `.step-card.open` (the two React calcs) joins `.det-row` / `.calc-det` / `<details>` in the snapshot's
  full/summary normalization list.
- **Per-calc print acceptance criteria**, because `injectPrintRules()` does **not** `!important` its
  `@page` and a calc's own `@page`, width, overflow and print-color rules can still win: header present on
  page 1, no clipped table columns, no orphaned section headings, Summary hides `.det-row`, Full shows it.

**Scope narrowed** *(new in Rev. 3)*. Rev. 2 also proposed removing redundant hand-rolled print buttons
from the 25 v2 calcs that carry them, while claiming only "eight visually-changed calcs" — an internal
contradiction Codex caught. Those 25 buttons are a duplicate-UI wart, not a defect; removing them would
force 25 additional visual reviews inside a change that is already large. **Deferred to a separate
follow-up.** The set receiving print-affecting changes in this plan is exactly the 7 gap calcs, and all 7
get in-depth visual review.

### 5. QA harness — `tools/qa-calc-roundtrip.mjs`

Playwright (new devDependency) against `next dev`, for all 55:

1. Re-derive the manifest; fail on drift, column-count violation, or duplicate filename.
2. Drive dynamic scenarios **from each calc's adapter**, including a scenario that **deletes a middle row**.
3. Fill deterministically from a seed; Project = `QA-TEST`. Include the `</script><img onerror=…>` payload
   case.
4. `await ready`, `await runAndSettle()`, await mutation-quiet; capture results as **complete normalized
   semantic content** *(strengthened in Rev. 3)* — numbers **plus** labels, PASS/FAIL statuses, units,
   governing case, warnings, and the set of result sections present. Numbers-only comparison would pass a
   snapshot that silently lost a FAIL badge or a whole section.
5. `buildSnapshot()`; assert: `#are-state` present, zero `<script src=`, no executable script, no `on*`
   attributes, no external `<link>`, no non-`data:`/non-fragment `url()` in any style block, parses
   standalone, under a size ceiling.
6. Fresh page; `loadFromHtml()` requiring **zero mismatches on the ordinary non-force path**. Force-apply
   is tested separately against a deliberately mutated file, as are schema-version and model-validation
   rejections.
7. Diff normalized results against baseline; any difference fails that calc.
8. **Offline verification for every snapshot** *(strengthened in Rev. 3)* — each of the 55 is opened in a
   context with request interception that fails the test on any network request, not one sample, since
   resource handling differs materially across plain, `are-calc.css`, React/Tailwind, SheetJS and STM calcs.
9. **Activation-ordering tests** *(new in Rev. 6)*. Playwright cannot drive a native folder dialog, but it
   can prove the ordering: `window.showDirectoryPicker` and `FileSystemHandle.requestPermission` are
   stubbed with fakes that assert `navigator.userActivation.isActive === true` at call time and record
   call order. Both activation-sensitive branches are covered — first-time `showDirectoryPicker()` and
   expired-handle `requestPermission()` — so a later refactor that reintroduces an `await` before the
   picker fails CI instead of reaching an engineer.
10. Render Summary and Full PDFs for all 55 as a regression baseline; for the 7 changed calcs,
   **rasterize pages and assert bounding-box/overflow** rather than inferring from page count, and retain
   the images as artifacts.

Output: `tools/qa-report.md`, committed as evidence.

**Manual acceptance** *(expanded in Rev. 5 — the primary path is the directory handle, not `showSaveFilePicker`)*:

1. `showDirectoryPicker()` against a real OneDrive project folder; save; confirm the file lands there and
   OneDrive syncs it.
2. Close the browser, reopen, save again — confirm the remembered handle is reused and, where the grant
   has lapsed, that the `requestPermission()` re-prompt path is smooth.
3. Save the same calc twice in one day; confirm the `-r2` collision name.
4. `showSaveFilePicker({ startIn: dirHandle })` "Save as…" to a different folder.
5. Force the anchor-download fallback; confirm the toast names it.
6. Reload a saved file under a second Windows/browser profile with no stored handle.
7. Eye review of the 7 changed calcs in both print modes.

### 6. Verification gate before redeploy

A Fable subagent reviews this plan and, separately, the complete diff before deploy — snapshot inertness,
mismatch-blocking, adapter and model-validation correctness, print collisions, and confirmation that
`/api/calc/*`, `calc-store.ts`, `calc-api.ts`, `are-state-loader.js` and the Revit integration are
untouched. Deploy via `are-calcs-deploy` only after the harness is green and the subagent signs off.

## Key decisions & tradeoffs

1. **No server storage.** Rejected Neon/Vercel Postgres despite `calc-store.ts` already supporting it: the
   value is the file living in the project folder under existing OneDrive permissions. Cost: no
   cross-project query, no audit trail beyond the filesystem.
2. **One `.html`, not `.html` + `.json`.**
3. **Frozen DOM, not a re-runnable offline calc** — makes React, Babel, Tailwind, SheetJS and the 182 KB
   STM engine irrelevant to the artifact. Cost: the record is not editable in place.
4. **Per-calc adapters over a universal heuristic** — 12 files to write and verify, but the only approach
   that survives `render()`-driven DOM, indexed add-functions, nested collections and deletions.
5. **The model owns its subtree** *(Rev. 3)* — `ownedFields` removes the double-storage ambiguity between
   tiers.
6. **Fail-closed everywhere** — ambiguous key, uninlinable resource, surviving `url()`, missing run hook,
   unresolved readiness, schema-version mismatch, or any field mismatch stops the operation and says why.
7. **`data-no-theme` by default**; opt in to restyling per calc after inspection.
8. **Print-button cleanup on 25 calcs deferred** *(Rev. 3)* — keeps the reviewable surface to 7 calcs.
9. **Project field required**; **date in filename**; sequential revision probing on collision, which is
   only possible via the directory-handle path.
9a. **`calcRevision` warns, it does not reject** *(Rev. 4)* — a content hash that hard-fails would make
    every saved file unloadable after any deploy, defeating the goal. Version governance sits on
    `schema`/`adapterVersion`; incompatibility is caught by the field-mismatch gate.
9b. **`showDirectoryPicker()` is the primary save path** *(Rev. 4)* — `showSaveFilePicker()` returns only
    a file handle with no parent traversal, so folder memory and collision probing require a directory
    handle. The engineer picks the project folder once.
9c. **Loaded model strings are untrusted input** *(Rev. 4)* — constrained by schema and rendered via
    `textContent`/escaping, because these files are designed to travel between engineers.
10. **Mismatch blocks rather than warns.** A silently half-populated calc that looks complete is the worst
    outcome available to a stamping engineer.
11. **Server API and Revit integration untouched**, deliberately.
12. **Observability right-sized** — typed error codes, distinct toasts, console diagnostics. Codex asked
    for telemetry; **rejected**: there is no collection endpoint in a server-free design and standing one
    up reintroduces the hosted dependency this plan exists to avoid.

## Risks / open questions

- ~~**File System Access API inside the iframe.**~~ **RESOLVED 2026-08-15 — proven, not assumed.**
  `tools/spike-fsa-iframe.mjs` drives a trusted Playwright click inside a same-origin unsandboxed iframe
  reproducing the production calc frame. Result: dialog opened, `AbortError` on dismissal — **permitted**.
  A cross-origin negative control (page on `127.0.0.1`, frame on `localhost`, same dev server) returned
  `SecurityError: Cross origin sub frames aren't allowed to show a file picker.`, confirming the test can
  detect blocking rather than being blind to it. Both cases ran with `userActivation.isActive === true`.
  The directory-handle design stands; the spike is retained as a regression test.
- **Persisted directory handles are a permission, not a guarantee.** Chrome may revoke the grant between
  sessions; the re-prompt path has to be as smooth as the happy path or engineers will stop using Save.
- **The adapters are not the main schedule risk — the legacy code around them is** *(revised in Rev. 7)*.
  Twelve adapters break down as roughly five cheap (real JS models, one with export/import already built),
  four moderate DOM-serialization jobs, one workflow replay (`headers_gradebeam_pier`), and two React with
  demolition attached. On top of that sits work no earlier revision counted: **five inline-v1 strips**,
  **two React override removals**, and **`ready` instrumentation for seven calcs that expose no signal
  whatsoever today**. Realistic effort is the adapter work **plus about a third again** in per-calc
  surgery, and each stripped file needs visual re-verification. If this lands over budget, that is where.
- **`column_base_plate_v3`: Save yes, post-upload reload accepted as a limitation** *(revised by Nick,
  2026-08-16, superseding the 2026-08-15 decision to build a full adapter)*. Saving works on every path —
  the snapshot is a frozen post-run DOM and is a truthful record regardless. What is NOT supported is
  *reloading* a file that was saved after a RISA workbook upload: `buildTable()` regenerates the input
  rows with member-derived ids (`fPu_<mid>`), which do not exist on a fresh page, so the fail-closed
  mismatch gate blocks the load and says which fields are missing. It blocks rather than corrupts, which
  is the correct failure. Revisit only if the upload workflow becomes routine.
- **Other legacy save UI is deferred but should be named**: `masonry_anchor` has its own JSON save/load
  buttons (~1290–1307) and `stacked_shearwall` has export/import (969–1020). Same class as the deferred 25
  print buttons — left in place for now, and `stacked_shearwall`'s is actively useful to its adapter.
- **The QA harness needs live CDN access** for the two React calcs (unpkg React, cdn.tailwindcss.com,
  cdnjs SheetJS) when running against `next dev` — a CI flake risk worth pinning or vendoring.
- **Snapshot CSP has no `font-src`** — harmless with a system font stack, contradictory if the
  "self-contained font stack" ever embeds a `data:` font. Decide one way when writing it.
- **Tier-A structural keys stay brittle** across future markup edits; mitigated by the mismatch block and
  `calcRevision`, but a restructured calc can orphan old files. Adding `id`s to id-less inputs in the 19
  affected calcs would reduce path reliance and is worth doing opportunistically.
- **Print acceptance is per-calc judgement**; rasterized overflow assertions catch gross failures, not
  subtle ugliness.
- **`composite_stud_blockout`** is genuinely custom print work with no conventions to lean on.
- **Snapshot longevity** rests on inlined CSS and sibling-selector radios only — no `:has()`, no JS, no
  network.

## Out of scope

- Any database, hosted storage, or cloud project store; Microsoft Graph / SharePoint integration.
- Changes to `/api/calc/run`, `/api/calc/[id]`, `calc-store.ts`, `calc-api.ts`, `are-state-loader.js`, the
  Calc State v1 schema, or the pyRevit `SendToCalc` integration.
- Removing the redundant hand-rolled print buttons from the 25 v2 calcs that carry them (deferred).
- Migrating the site to a single stylesheet; server-side calculation.
- `steel-calc-template-eval-review.html`.
- **Any change to engineering logic in any calculator.** This work touches persistence and print only. If
  the harness surfaces a numerical difference, that is a bug in this feature, not a licence to alter a calc.
