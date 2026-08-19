# Plan Review Log: Server-free saved calculations + print standardization (55 calcs)

Act 1 (grill) complete — plan locked with the user 2026-08-15. MAX_ROUNDS=5.
Reviewer model: CLI default (config unpinned) — codex-cli 0.144.1.

Act 1 resolved six decisions across the design tree:

1. **Storage** — no database, no hosted store. Saves are files written into the OneDrive project folder
   by the browser. Nick: "i need to be able to save this onto onedrive folder so other engineers can use
   it or it's not useful."
2. **Browsers** — Edge and Chrome only, so the File System Access API is available.
3. **Artifact** — one self-contained `.html` per save: frozen post-run DOM (printable record) with the
   input state embedded as inert JSON (reloadable). Nick: "if it can be loaded back into the website then
   only the html file."
4. **Filename** — `<Project> - <Calc name> - <YYYY-MM-DD>.html`, Project field required, Save blocked
   until filled.
5. **Legacy-CSS calcs** — the three on `are-calc.css` (incl. the Deep Beam STM calc) keep their current
   appearance; `are-utils-v2.js` gains a theme-injection opt-out rather than restyling them.
6. **Field mismatch on load** — block, list every unmatched field in both directions, require explicit
   confirmation. No silent partial load.

Findings from codebase exploration that shaped the plan rather than being asked:

- The existing `areSave()` is `localStorage`-backed *and* incomplete — it selects only `[id]` elements, so
  it silently drops dynamic rows on ten calcs and id-less inputs on eight.
- `/api/calc/*` is live production, consumed by pyRevit `SendToCalc`; declared out of scope.
- Zero `<canvas>` elements exist site-wide; all drawings are SVG from `are-draw.js`, so snapshots need no
  rasterization.
- Two calcs are React + in-browser Babel; a frozen-DOM snapshot sidesteps them entirely, but *loading*
  into them requires the native value-setter path.

---

## Round 1 — Codex

The plan is not ready to implement. Concrete problems found:

- Scope/count conflict: the plan says “seven gap calcs” but lists eight, and `masonry_reinforced_wall_asd_calculator.html` already includes `/are-utils-v2.js` at line 2769; fix: derive and commit an authoritative 55-calculator coverage manifest before editing.
- The proposed dynamic-row manifest cannot represent `stacked_headers_studs_calculator.html`: `addHeader(fi)` and `addStudRow(fi)` require a floor index, while the schema stores only a zero-argument `addFn`; fix: use explicit per-calculator serialize/restore adapters with function arguments and hierarchy.
- Child-count manifests lose dynamic structure: stacked headers has floors containing variable header and stud collections, not one flat `rowCount`; fix: serialize the calculator’s nested model or a typed hierarchy rather than inferred DOM child counts.
- “Nearest add button” discovery is undefined for real markup: in `web_opening_calculator.html`, the changing containers are `<tbody>` elements while their add buttons are outside the table and are neither ancestors nor descendants; fix: explicitly map each dynamic container to its add operation.
- Child-count comparison is not a reliable dynamic-container detector because calculators render results, SVG nodes, option lists, toolbar elements, and other non-input children after startup; fix: whitelist input-bearing dynamic containers instead of comparing every ancestor to an unspecified “pristine” snapshot.
- The pristine baseline has no defined capture time and can race `DOMContentLoaded`, async workbook fetches, React rendering, and calculator initialization; fix: register adapters after each calculator’s ready signal and test readiness explicitly.
- DOM paths do not round-trip through rerendering: stacked-header inputs are emitted by `render()`, and dispatched `change` handlers mutate the model and rerender portions of the DOM, invalidating later stored element references and paths; fix: restore model data atomically through a calculator adapter, then render once.
- Replaying only row counts cannot reproduce deletions or non-default topology; for example, deleting a middle web-opening row changes IDs and array state even when the final count is unchanged; fix: serialize row identities/order and rebuild the collection from empty.
- The structural-key proposal omits escaping and uniqueness rules: generated selectors using arbitrary IDs or names require `CSS.escape`, and `name[i]` is ambiguous across unrelated controls sharing a name; fix: define escaped, document-global keys and reject duplicate resolution during capture.
- Disabled id-less presentation controls are captured as real fields—for example the fixed-position inputs and locked selects in `deep_beam_stm_calculator.html`—creating unnecessary mismatches when display markup changes; fix: exclude disabled presentation-only controls or explicitly mark persisted inputs.
- The mismatch comparison will reject every normal load unless exclusions are applied symmetrically: `areJob`, file inputs, the new print checkbox, toolbar controls, and injected hub controls appear on the live page but not in `fields`; fix: use one shared `isPersistableField()` predicate for capture, lookup, and both-direction diffs.
- Plain `.value` plus events is insufficient for React: checkboxes require the native `checked` setter, selects require their own native setter, and React updates are asynchronous; fix: implement type-specific setters and await a React/render stabilization condition before running calculations.
- Dispatching `input` and `change` for each field can trigger calculations and rerenders midway through restoration, while `autoRun()` is then called immediately; fix: add a restore transaction that suppresses calculation handlers, applies all state, releases suppression, and runs exactly once.
- `autoRun()` is an assumed five-name convention, not proof of compatibility across 55 files, and several calculators use debounced or initialization-specific flows; fix: record an explicit run hook in the per-calculator registry and await its completion.
- Textareas will not be frozen by writing a `value` attribute because their serialized default value is their text content; fix: set cloned textarea `textContent` and clear stale `value` attributes.
- Select serialization must first remove every existing `selected` attribute, otherwise a live choice can coexist with the original markup default and reload incorrectly; fix: normalize all option selection attributes from the live `selected` properties.
- Injecting raw JSON into an HTML `<script>` is unsafe: a project or field value containing `</script>` terminates the inert block and can inject active markup; fix: escape `<` as `\u003c` in the serialized JSON and enforce a restrictive CSP in the snapshot.
- Script stripping alone does not make the artifact inert: inline event-handler attributes, `javascript:` URLs, embeds, iframes, objects, and external resource links remain; fix: sanitize executable attributes/elements and remove or inline all network-bearing resources.
- “Offline, no network” is not guaranteed because the plan only inlines same-origin stylesheets and does not say that original `<link>` elements, images, iframes, or other external resources are removed; fix: audit every remaining URL-bearing attribute and inline or delete it, then verify with Chromium network disabled.
- Stylesheet fetching introduces failure and race paths not reflected by “two pure functions”; `buildSnapshot()` must be asynchronous, fetches may fail, and saving before completion can produce an incomplete artifact; fix: make snapshot construction explicitly async and fail closed with a list of uninlined required resources.
- Adding v2 to `wri_stiffened_slab_calculator.html` is not a simple migration: the file loads `/are-utils.js` and also contains a second embedded full v1 utility implementation starting after line 751, so globals and injected IDs/styles will collide; fix: remove both legacy implementations as one verified migration before loading v2.
- The print-collision claim is false as written: `injectPrintRules()` does not use `!important` on `@page`, and earlier calc rules can still control page layout, visibility, widths, overflow, and print color; fix: define per-calc print acceptance criteria and resolve conflicting selectors and `@page` rules explicitly.
- Existing print buttons are not consistently accounted for: `masonry_reinforced_wall_asd_calculator.html` and `hss_hanger_tension_connection_calculator.html` also have their own print buttons, but the table only calls out removal for other files; fix: inventory and specify disposition for every legacy print control.
- `data-no-theme` is assigned to only “three `are-calc.css` calcs,” yet the scope table names three such files plus several other legacy layouts whose global element selectors can also be changed by the v2 theme; fix: test theme injection per gap calc and default new integrations to opt-out unless explicitly migrated.
- A CSS-only print-mode checkbox does not reproduce `arePrint('f')`, which imperatively exposes `.det-row` and `.calc-det`; existing inline styles and `<details>` state can still win or remain closed; fix: normalize full/summary visibility in the cloned DOM and add snapshot-specific rules for each supported detail convention.
- `:has()` fallback cannot be deferred until after release because the saved engineering record must remain usable over its lifetime and may open outside current Chromium; fix: use two ordinary radio controls plus sibling/container selectors, or save a deterministic full-print artifact.
- The snapshot may capture stale results because many calculators debounce calculations or update asynchronously, and Save has no “calculation settled” gate; fix: expose and await a per-calculator settled promise before cloning.
- The QA harness force-applies after load, so it bypasses the plan’s central mismatch-blocking behavior and cannot prove normal loading succeeds; fix: require zero mismatches and perform the ordinary non-force apply in the primary round-trip test.
- Comparing “results DOM” is underspecified and likely unstable due to generated SVG markup, transient classes, expanded-state mutations, locale formatting, and runtime IDs; fix: compare normalized semantic outputs plus selected canonical rendered fragments.
- The harness’s “click every discovered add-row button twice” repeats the same unreliable heuristic and cannot cover add functions requiring arguments or nested additions; fix: drive dynamic scenarios from the same explicit adapter registry with expected structures and values.
- Testing print “by eye” on five samples does not support the claim that all eight changed print integrations are collision-free; fix: generate and retain summary/full PDFs or screenshots for every changed calculator and assert page count, clipping, and required sections.
- The saved snapshot keeps the toolbar’s Save/Load and Results Hub UI unless explicitly removed, but scripts are stripped, leaving prominent dead controls in the engineering record; fix: remove all interactive application chrome from the clone and add only functional snapshot print controls.
- Filename collision handling relies on an OS overwrite prompt, but anchor-download fallback commonly auto-renames instead; fix: include time or a revision token in the filename if unique records are required.
- IndexedDB-stored directory handles can lose permission across sessions, and the plan has no permission revalidation or telemetry; fix: call `queryPermission`/`requestPermission`, recover cleanly, and report which save path was actually used.
- Observability is inadequate: a generic toast does not distinguish picker failure, stylesheet failure, snapshot validation failure, mismatch rejection, forced partial restore, or calculation failure; fix: define typed error codes, console diagnostics, and QA assertions for every failure path.
- Removing localStorage load abandons existing saved inputs without even a one-time export path; fix: offer a temporary legacy-load-and-export migration before deleting the old UI behavior.

VERDICT: REVISE

### Claude's response — Rev. 2

Every checkable claim Codex made was verified against the repo before revising. All were true:
`masonry_reinforced_wall_asd_calculator.html:2769` does include v2 (my gap table was wrong);
`stacked_headers_studs_calculator.html:855,885,1021,1127` calls `addHeader(fi)`/`addStudRow(fi)` with a
floor index from inside `render()`; `web_opening_calculator.html:320-381` puts add buttons outside the
growing `<tbody>`; `wri_stiffened_slab_calculator.html:751,763` carries both a `/are-utils.js` tag and a
second complete inline v1 implementation; `hss_hanger_tension:82` and `masonry_reinforced_wall:112` have
their own print buttons; `deep_beam_stm` has 12 disabled/readonly inputs.

**Accepted and incorporated (structural):**
- The universal dynamic-row heuristic is abandoned for a **two-tier model**: generic capture for static
  calcs, explicit per-calc adapters (`getModel`/`setModel`/`runAndSettle`) for the 11 dynamic and 2 React
  calcs. This is the single largest change in Rev. 2 and it makes deletions, nesting, indexed add-functions
  and `render()`-driven DOM correct by construction rather than by inference.
- A shared `isPersistableField()` predicate applied symmetrically to capture, lookup and both diff
  directions. Without it the mismatch gate would have rejected every normal load on day one.
- Explicit readiness signal, restore transaction with suppression, and an explicit `runAndSettle()` hook
  replacing the assumed five-name `autoRun()` convention.
- `buildSnapshot()` is async and fail-closed; stylesheets read from `cssRules` rather than re-fetched.
- Serialization fixes: textarea `textContent`, `<select>` `selected`-attribute normalization, `checked`
  attributes from live properties.
- Artifact hardening: `<` escaped to `<` in the embedded JSON, `on*` attributes and `javascript:`
  URLs stripped, iframes/objects/embeds removed, external `<link>` (incl. Google Fonts) removed, meta CSP
  added, `.are-bar` toolbar chrome stripped from the record while keeping the `.are-ph` header.
- Print toggle rebuilt on two radios plus `~` sibling selectors — `:has()` dropped, since the record must
  open in browsers years from now. Full/Summary visibility normalized in the clone rather than left to CSS.
- `wri_stiffened_slab` reclassified from "include a script" to a verified three-way migration.
- `data-no-theme` becomes the **default** for all seven gap calcs, opt-in per calc after inspection.
- Authoritative manifest derived from the files and committed at `tools/calc-coverage.csv`; the harness
  re-derives it and fails on drift. This corrected the gap list from 8 to 7 and surfaced that 25 v2 calcs
  carry redundant hand-rolled print controls.
- QA harness rewritten: primary round-trip requires **zero mismatches on the ordinary non-force path**,
  results compared as normalized semantic output, dynamic scenarios driven from adapters including a
  middle-row deletion, PDFs for every changed calc rather than a sample, and one offline (network-disabled)
  open verified.
- FSA directory handles revalidated via `queryPermission`/`requestPermission`; download-fallback
  auto-rename acknowledged with a revision suffix and the save path reported in the toast.
- One-release "Load last local save" bridge before localStorage is dropped.

**Rejected, with reason:**
- **Telemetry for save-path/failure reporting.** There is no collection endpoint in a deliberately
  server-free design, and standing one up would reintroduce the hosted dependency the whole plan exists to
  avoid. Typed error codes, distinct toasts and console diagnostics are kept; aggregation is not.


## Round 2 — Codex

Most prior findings are addressed, especially dynamic-row adapters, restore transactions, symmetric exclusions, WRI cleanup, inert snapshots, and non-force QA. Material issues remain:

- The JSON breakout fix is still wrong as written: step 9 says escape `<` to `<`, which performs no escaping; fix: explicitly serialize `<` as the six-character JSON escape `\u003c` and add a test containing `</script><img onerror=...>`.
- CSS inlining is not recursive: `public/Calcs/are-calc.css` contains two external `@import url(...)` rules, and reading `cssRules` can preserve those imports in the snapshot; fix: recursively inline or remove every `CSSImportRule` and reject any non-fragment `url()` remaining in final CSS.
- The URL audit covers attributes but not CSS, so external `url(...)` resources can survive while CSP silently blocks them; fix: parse all final style blocks and fail if a URL is not `data:` or a local SVG fragment such as `url(#marker)`.
- The radio/general-sibling toggle is underspecified and will not reach nested calculation sections unless all record content is wrapped as a sibling following the radios; fix: define a snapshot wrapper and selectors such as `#are-summary:checked ~ .are-snapshot-content .det-row`.
- Tier-B persistence is internally ambiguous: the plan says the model is authoritative but also restores Tier-A fields and performs DOM-field mismatch checks, potentially duplicating the same state and rejecting valid model-driven pages; fix: define per-adapter whether DOM fields are model-owned and exclude those fields from generic capture/diff.
- React restoration still describes DOM native setters even though React component state is declared authoritative; DOM changes do not reliably update hook state, particularly without React’s internal event tracking; fix: expose component-owned `getModel`/`setModel` callbacks and restore React state through them, not through DOM setters.
- “Default readiness = load plus one animation frame” does not cover the six workbook-fetching calculators or asynchronously populated options; fix: give every async-data calculator an explicit readiness promise and make Save unavailable until it resolves.
- `runAndSettle()` returning a synchronous calculation result does not prove debounced DOM work has settled; fix: require adapters to resolve only after their final render/mutation and verify stability across consecutive animation frames.
- No snapshot schema/version validation is specified in Rev. 2, despite long-term compatibility being a core goal; fix: store and validate a top-level schema version, adapter version, calculator revision, and bounded model shape before applying anything.
- Adapter models are stored “verbatim” with no validation, allowing malformed or oversized imported JSON to reach calculator-specific setters; fix: add per-adapter schema validation, size/depth limits, allowed-key checks, and numeric range/type validation before `setModel()`.
- The QA comparison now extracts only numeric result text, so it can miss changed PASS/FAIL status, units, governing cases, warnings, equations, or missing result sections while numbers happen to match; fix: compare normalized complete semantic result content, including labels, statuses, units, warnings, and section presence.
- “Absence of clipping” cannot generally be asserted from PDF page count alone; fix: render PDF pages to images and use explicit bounding-box/overflow assertions plus retained visual artifacts.
- The visual-QA count is inconsistent: the plan removes print controls from 25 existing-v2 calcs plus seven gaps, yet refers to only “eight visually-changed calcs”; fix: define exactly which files receive visual changes and require visual review for all of them or narrow the cleanup scope.
- The coverage CSV schema appears malformed: its header begins `slug,file,v2,...`, but its rows begin with a filename followed immediately by flags, so columns are shifted or `slug` is missing; fix: correct the manifest schema and add strict column-count/type/unique-file validation before treating it as authoritative.
- Filename revision handling is incomplete: checking existence and offering only `-r2` still collides when `-r2` already exists; fix: probe sequential revisions or include a timestamp/unique revision token.
- Only one offline test is planned even though CSS/resource handling differs materially across plain, `are-calc.css`, React/Tailwind, SheetJS, and STM calculators; fix: run the network-disabled standalone test for every snapshot, or at minimum every dependency class with automated failure on any request.

VERDICT: REVISE
### Claude's response — Rev. 3

Both checkable round-2 claims verified true before revising: `public/Calcs/are-calc.css:11,17` carries two
external `@import url(...)` rules that a flat `cssRules` read would preserve, and the Rev. 2 coverage CSV
was malformed (9 header columns, 8 data columns). The manifest was regenerated and now validates —
9 columns, 55 rows, 0 column-count mismatches, 0 duplicate filenames.

**Accepted and incorporated:**
- The `<` escape is now stated correctly — Rev. 2's text was a literal no-op. Added a regression test
  embedding `</script><img src=x onerror=alert(1)>` in the Project field.
- Recursive CSS inlining through every `CSSImportRule`, with external imports removed rather than followed.
- URL audit extended to CSS: fail closed on any final `url()` that is not `data:` or a local SVG fragment.
- Print toggle given an explicit `.are-snapshot-content` wrapper so sibling selectors reach nested sections.
- **Tier-A/Tier-B ambiguity resolved** via `ownedFields` on each adapter — model-owned subtrees are
  excluded from generic capture and from both diff directions, ending the double-storage risk.
- **React restoration moved inside the component.** The adapter closes over the app's own state setters;
  Rev. 2's DOM-native-setter language is removed, since driving DOM inputs does not reliably update hook
  state when the component is authoritative.
- Explicit `ready` promise required for every async-data calc (six SheetJS/workbook, two React, any with
  async-populated options); Save disabled until it resolves.
- `runAndSettle()` must resolve after final mutation, plus a MutationObserver quiet-period stability check
  across consecutive animation frames.
- Snapshot versioning: `schema`, `adapterVersion`, `calcFile`, `calcSlug`, `calcRevision` content hash,
  all validated before anything is applied.
- Per-adapter model validation — allowed keys, types, numeric ranges, size and depth limits — before
  `setModel()` is ever reached.
- QA comparison widened from numeric text to complete normalized semantic content: labels, PASS/FAIL
  statuses, units, governing case, warnings, and section presence.
- Clipping asserted by rasterizing PDF pages and checking bounding boxes, with images retained, rather than
  inferred from page count.
- Offline (network-intercepted) verification extended from one sample to **all 55 snapshots**.
- Filename collisions probe sequential revisions rather than assuming `-r2` is free.
- Manifest schema validated (column count, types, uniqueness) before it is treated as authoritative.

**Scope narrowed in response to the visual-QA contradiction:**
- Codex correctly caught that Rev. 2 proposed removing redundant print buttons from 25 existing-v2 calcs
  while claiming only "eight visually-changed calcs". Rather than expand visual review to 32 files inside
  an already-large change, the 25-calc print-button cleanup is **deferred to a separate follow-up**. Those
  buttons are a duplicate-UI wart, not a defect. The print-affecting set in this plan is exactly the 7 gap
  calcs, all of which get in-depth visual review.

**Rejected, with reason (carried forward from round 1):**
- **Telemetry.** No collection endpoint exists in a deliberately server-free design; adding one
  reintroduces the hosted dependency the plan exists to avoid. Typed error codes, distinct toasts and
  console diagnostics are kept; aggregation is not.


## Round 3 — Codex

Rev. 3 addresses most prior findings, and the manifest now validates at 55 rows, 9 columns, and zero duplicate filenames. Three material issues remain:

- JSON escaping is still a no-op in the actual plan text: it says replace `<` with `<`, `>` with `>`, and `&` with `&`; fix: specify literal replacement strings `\\u003c`, `\\u003e`, and `\\u0026` in JavaScript and assert the serialized HTML contains no literal `</script`.
- Strictly validating `calcRevision` as a content hash would make every saved file unloadable after virtually any calculator deployment, contradicting “any later session”; fix: treat revision mismatch as a compatibility warning while schema/adapter versions govern rejection, or define explicit migrations between adapter versions.
- The File System Access design assumes `showSaveFilePicker()` provides the chosen directory handle, but it returns only a `FileSystemFileHandle` with no parent-directory traversal; therefore directory persistence and sequential collision probing cannot work as described; fix: use `showDirectoryPicker()` and `directoryHandle.getFileHandle(name, {create:false/true})`, or abandon remembered-directory probing and use timestamped filenames through `showSaveFilePicker()`.

One additional security requirement should be explicit:

- Adapter schema validation permits strings that calculator renderers may interpolate into `innerHTML`; a hand-edited snapshot could therefore inject markup into the live calculator before snapshot sanitization applies; fix: constrain adapter string fields by length/content and require model renderers to assign text via `textContent` or HTML-escape values.

VERDICT: REVISE
### Claude's response — Rev. 4

All four round-3 findings accepted. Two of them were errors I had made twice.

- **JSON escaping stated as code, not prose.** Rev. 2 and Rev. 3 both described the escape in words and
  both came out as no-ops. Rev. 4 gives the literal `.replace(/</g, '<')` chain and asserts the
  serialized HTML contains no literal `</script` substring.
- **`calcRevision` demoted from gate to notice.** Codex was right that hard-failing on a content hash
  would make every saved file unloadable after essentially any deploy — directly contradicting the "any
  later session" goal this plan exists to serve. `schema` and `adapterVersion` govern rejection;
  a revision difference raises a non-blocking notice and falls through to the field-mismatch check.
- **File System Access design corrected.** `showSaveFilePicker()` returns a `FileSystemFileHandle` with no
  parent-directory traversal, so Rev. 3's remembered folder and `-r2` probing were both impossible through
  it. Rev. 4 uses `showDirectoryPicker()` as the primary path — the engineer points at the project folder
  once — with `dirHandle.getFileHandle(name, {create:false})` for genuine collision probing, and
  `showSaveFilePicker({startIn: dirHandle})` as an explicit "Save as…" that claims no probing.
- **Loaded model strings treated as untrusted.** Snapshot sanitization protects the output file and does
  nothing for the input path, while several calcs concatenate model strings into `innerHTML`. Adapter
  schemas now constrain string fields by length and character allowlist, and any renderer interpolating
  model strings into `innerHTML` is converted to `textContent` or escaped as part of writing its adapter.


## Round 4 — Codex

The four round-three findings are addressed. Rev. 4 is substantially sound, but one critical browser-API flaw and two smaller gaps remain:

- Picker calls require transient user activation, but the plan’s Save flow builds the snapshot asynchronously before describing directory/file selection; `await runAndSettle()`, mutation quieting, and CSS processing can consume activation, causing `showDirectoryPicker()`, `showSaveFilePicker()`, or `requestPermission()` to throw `SecurityError`; fix: invoke the picker or permission request immediately inside the click handler, then asynchronously build and write the snapshot.
- Collision probing has a check-then-create race: two tabs can both observe the same free revision and then open it with `{create:true}`, allowing one save to overwrite the other; fix: use a timestamp/random suffix for guaranteed uniqueness, or explicitly accept and document that revision probing is advisory rather than overwrite-safe.
- The manual acceptance step still specifies only `showSaveFilePicker`, although the primary remembered-folder workflow is now `showDirectoryPicker` plus `getFileHandle`; fix: manually test both the primary directory-handle path—including permission restoration and collision naming—and the Save As fallback.
- External citations are described as “inert links,” but retained `<a href>` elements remain navigable; fix: call them navigable citations and add `rel="noopener noreferrer"` for new-tab links, or remove `href` if truly inert behavior is intended.

VERDICT: REVISE
### Claude's response — Rev. 5

All four round-4 findings accepted; one was a genuine blocker.

- **Transient user activation ordering.** Picker calls and `requestPermission()` require transient
  activation, which is consumed once an `await` chain returns. Rev. 4's flow built the snapshot first and
  would have thrown `SecurityError` on every save. Rev. 5 inverts it: the click handler synchronously
  validates, then acquires the destination handle before any `await`, then builds and writes.
- **Collision probing is advisory, and now says so.** `getFileHandle(create:false)` then `create:true` is
  check-then-create. Documented rather than solved — the alternative is a timestamp in every filename,
  which sacrifices the readable naming that was explicitly chosen, against a race requiring two engineers
  saving the same calc for the same project in the same instant. Last write wins, as on any share.
- **Manual acceptance rewritten** around the directory-handle path: permission restoration after a
  browser restart, collision naming, the Save As fallback, the download fallback, and a second-profile
  reload — not just a single `showSaveFilePicker` write.
- **Citations described honestly.** Rev. 4 called retained `<a href>` elements "inert"; they navigate.
  They are now called navigable and carry `rel="noopener noreferrer"`, and are kept deliberately, since a
  reference that cannot be followed is worth less in the record.


## Round 5 — Codex

Rev. 5 addresses the four prior findings. One implementation-critical ordering detail remains:

- A persisted directory handle cannot be retrieved from IndexedDB synchronously inside the Save click handler; if lookup begins on click, the subsequent picker or `requestPermission()` call may lose transient activation. Fix: preload the handle and its permission state during page initialization, cache it in memory, and keep Save disabled until both destination state and calculator readiness are known.
- Likewise, a Promise’s resolved state cannot be checked synchronously without tracking it separately. Fix: maintain explicit `calcReady` and `destinationReady` flags so preflight validation performs no awaited work before invoking a picker or permission prompt.
- Add an automated browser test for both activation-sensitive branches—first-time `showDirectoryPicker()` and expired-handle `requestPermission()`—because the existing harness bypasses native picker behavior and manual testing alone could miss a later ordering regression.

The remaining architecture and QA plan are otherwise coherent.

VERDICT: REVISE
### Claude's response — Rev. 6 (MAX_ROUNDS reached)

All three round-5 findings accepted without dispute. They are refinements of the same activation-ordering
constraint raised in round 4, and Codex is right that Rev. 5 had not carried it far enough:

- **Preloaded destination state.** Reading the persisted directory handle out of IndexedDB is itself
  asynchronous, so doing it inside the click handler would consume the activation Rev. 5 was trying to
  protect. The handle and its permission state are now loaded at page init and cached in memory; the
  handler reads a plain variable.
- **Explicit readiness flags.** A promise's settled state cannot be read synchronously, so `calcReady` and
  `destinationReady` are tracked as booleans set by `.then()` at init, and Save stays disabled until both
  are true. Preflight inside the handler is then pure synchronous field validation.
- **Automated activation tests.** Playwright cannot drive a native folder dialog, but it can stub
  `showDirectoryPicker` and `requestPermission` with fakes that assert `navigator.userActivation.isActive`
  at call time and record call order — covering both the first-time-picker and expired-handle branches, so
  a future refactor that reintroduces an `await` before the picker fails CI rather than reaching an
  engineer.

**Loop terminated at MAX_ROUNDS=5 without an APPROVED verdict.** This is not a deadlock: there are **no
unresolved disagreements**. Every finding across all five rounds was either verified against the repo and
accepted, or rejected once with a logged reason (telemetry, round 1). Codex's own round-5 summary states
the remaining architecture and QA plan are coherent. Findings narrowed monotonically — 34, then 15, then
4, then 4, then 3 — and the last three were refinements of one issue rather than new territory. The plan
goes to Nick for sign-off with that stated plainly.


---

## Act 2b — Fable plan verification (post-MAX_ROUNDS)

Independent verification of Rev. 6 against the actual calculator files, run because Nick required a Fable
subagent to verify the plan before any code. It found four things five rounds of Codex review did not,
because Codex reasoned about the plan's own description of the files while this pass read the files and
cross-checked them against the committed manifest columns. All claims below were re-verified directly
before Rev. 7 was written.

**Blockers found:**

1. **The §4 gap fix would have silently done nothing on `embed_plate_beam_bearing`.** `injectToolbar()`
   opens `if (document.getElementById('areBar')) return;` (`are-utils-v2.js:71`), and that calc builds its
   own `areBar` at 1932 from a complete inline v1 (`areSave` 1983, `areLoad` 2007, `arePrint` 2051).
   Adding the v2 script tag yields no toolbar and leaves the localStorage save live. The manifest's
   `v1_inline` column recorded this; the plan text never acted on it.
2. **`column_base_plate_v3` was misclassified as static Tier A.** `loadExcel()` (`:827`) sets
   `MBR=parsed` (`:841`) and `buildTable()` regenerates inputs with member-derived ids (`fPu_<mid>`,
   `ssec_<mid>`, `:293,:323`). A save taken after a RISA upload would be permanently unloadable on a fresh
   page, rejected by the very fail-closed gate that was supposed to protect the engineer.
3. **Conditional rendering causes silent data loss in Full-Calc snapshots.**
   `stacked_headers_studs:1016` guards per-floor tables with `if(fl.exp){…}` — a collapsed floor is not in
   the DOM at all, so the sanitize/normalize step cannot reveal it. A record saved with a floor collapsed
   would be missing that floor with no indication. `stacked_shearwall` shares the pattern.

**Significant:**

4. Three calcs that already carry v2 — `snow_load` (bar 1496, v2 tag 1665), `asce_irregularity`
   (1400/1568), `rectangular_diaphragm` (1243/1411) — build a v1 bar *before* v2 loads, so v2 has been
   bailing out on them all along and the new Save UI would never appear.
5. Both React calcs redefine `window.areSave`/`areLoad` *after* the v2 tag (`hss_connection_complete:894`,
   `directly_welded_HSS:1020`) and would hijack the new Save.
6. The async census is **seven**, not six: `web_stiffener:225-231,299` fetches a shapes JSON and gates on
   `DB_LOADED`. None of the seven exposes any promise or event today.
7. The two-animation-frame settle gate is shorter than real timers in this codebase —
   `channel_joist_bearing:1066` retries at **250 ms**, `masonry_anchor:1840` at 80 ms, `snow_load:2269` at
   50 ms — so it could pass and then the DOM mutates.
8. Adapter composition corrected: two false positives (`channel_joist_bearing`, `masonry_anchor` — their
   growth is results tables only), one missing (`column_base_plate_v3`), one workflow-replay case
   (`headers_gradebeam_pier`, tables exist only after **Generate Tables**), and one nearly free
   (`stacked_shearwall` already has `exportProject`/`importProject`).
9. Restore-suppression semantics were undecided and would break `stacked_headers_studs:796`, where `LV[k]`
   is maintained only inside the `change` handler.

**Confirmed correct:** iframe same-origin and unsandboxed, the `are-calc.css` `@import` finding, the wri
three-way migration, the FSA ordering and `showDirectoryPicker` design, the escape chain, Tier-A key
coverage for id-less controls (all are named radios or disabled presentation controls — no counterexample
found), and the untouched-scope claim for `/api/calc/*`, `calc-store.ts`, `calc-api.ts`,
`are-state-loader.js` and `revit/`.

### Claude's response — Rev. 7

All nine findings accepted; none required redesign, all were plan edits. Changes: legacy-implementation
inventory table added to §4 covering five inline-v1 strips plus two React override removals; Tier-B list
corrected to twelve adapters with the composition table; expand-all-before-clone added as a snapshot step;
settle gate changed from frame-based to time-based; suppression semantics decided (suppress re-render and
recalculation, not model-maintaining handlers; model-synchronising inputs go in `ownedFields`); readiness
census corrected to seven with the note that all seven need new instrumentation; manifest demoted from
authoritative-for-classification to authoritative-for-coverage; `.step-card.open` added to the
normalization list; effort estimate revised to adapters **plus roughly a third again** in uninventoried
per-calc surgery; `column_base_plate_v3` flagged as possibly warranting a documented limitation rather
than a twelfth adapter; CDN/CI, CSP `font-src`, and deferred legacy save UI named in Risks.

**Verdict carried to Nick:** architecture sound and unchanged across two independent adversarial passes;
the plan-level defects were all in the migration inventory and classification data, which are now
corrected. No code has been written.

---

## Act 4 — Implementation, Fable diff review, and QA hardening (2026-08-15/16)

Built per PLAN.md Rev. 7. Evidence lives in `tools/qa-report.md`; run everything with `npm run qa`.

**Proven before building anything.** `tools/spike-fsa-iframe.mjs` drove a trusted click inside a
same-origin unsandboxed iframe: dialog opened, `AbortError` on dismiss. A cross-origin negative control
(page on 127.0.0.1, frame on localhost) returned `SecurityError: Cross origin sub frames aren't allowed to
show a file picker`, proving the test could detect blocking rather than being blind to it.

**Adapters: 6, not 12.** The plan's list came from heuristics; measurement removed half. Iterative restore
(new — apply what resolves, let the calc rebuild, repeat, roll back if it cannot converge) removed `beam`
and `asce_irregularity` outright. `snow_load` passes via its hidden JSON bridge. `channel_joist_bearing`
and `masonry_anchor` were false positives. `column_base_plate_v3` was reduced to save-only by Nick.

**Bugs found in existing code, by the harness rather than by reading:**
- `wri_stiffened_slab_calculator.html` was TRUNCATED at HEAD — ended mid-token, no closing tags. Repaired.
- An eighth legacy override (`masonry_anchor_bolt`'s localStorage version shim) that detection missed
  because it wrapped rather than replaced. Replaced with the new `AREv2.onAfterRestore` hook.
- `snow_load`, `asce_irregularity`, `rectangular_diaphragm` built a v1 toolbar BEFORE the v2 tag, so
  `injectToolbar()`'s `if (getElementById('areBar')) return` guard had been making v2 a silent no-op.
- **The shape-database clobber.** `W_beam_to_HSS_column` / `HSS_to_HSS_branch` ship a small hardcoded
  fallback shape table that satisfies any "options exist" readiness check; `applyDb()` then loads the real
  workbook and RESETS the section, so a restored calc silently computed a different steel member with zero
  mismatches reported. Only the results diff caught it. Gated on `applyDb`'s own status line.

**Fable's diff review found two blockers the 55/55 did not:**
1. `AREv2.expandAll()` sets inline `display:table-row !important`; the clone was taken after it, baking
   inline `!important` into every saved file, where it outranks the snapshot stylesheet — **every Summary
   printed as a Full Calc on ~48 calcs** — and the live page was left permanently expanded, breaking its
   own `arePrint('s')`. Also moved the print radios out of their labels, so two naked radios printed on
   page 1. Fixed; the harness now opens a saved file and asserts Summary hides fewer rows than Full.
2. The React calcs' pass was **vacuous** — 2 fields each, because CDN scripts failed and a BENIGN filter
   swallowed the 404s. Load is now refused there with an explicit message (DOM restore cannot drive React
   state, which would show new inputs beside stale results); Save still works.

**QA hardening (Fable work order):** manifest drift gate as stage 0 with an anti-vacuous floor and an
adapter→model cross-check; `test-adversarial-load.mjs` (40/40) covering injection plus the full
rejection/rollback/force contract; delete-middle-zone and collapsed-floor scenarios. The collapsed-floor
test found a further defect: state was captured AFTER `expandAll`, so a file saved with a floor collapsed
recorded every floor expanded. State is now captured before expansion.

**Outstanding:** delete-middle-row scenarios for the five dynamic calcs other than `headers_gradebeam_pier`;
the 25-calc redundant print-button cleanup (deferred by design); rasterized PDF baselines (skipped on
Fable's advice — the print-mode assertion covers the motivating failure).

**Final state: 55/55 round-trip, 40/40 adversarial, activation ordering verified, manifest gate green.**

---

## Field report — first real multi-engineer file exchange (2026-08-18)

The first file another engineer saved and handed over broke both ways, one real
defect and one UX trap, diagnosed from the actual file
(26-038-HNR (ZONE A) - Wood Headers, Jambs & Studs - 2026-08-18.html):

1. **Load rejected legitimate labels.** His stud labels — "GL A6 - A14, & GL A24
   (interior wall)" — were refused with BAD_MODEL because the adapter's
   stringPattern allowlist did not include "&" or ",". The allowlist was
   arbitrarily tighter than the security requirement: every label reaches
   innerHTML through xe() escaping, so the schema only needs to deny
   markup-capable characters. Worse, the failure was ASYMMETRIC — Save accepted
   what Load rejects, so the file was born unloadable and the author never knew.

2. **The frozen record masqueraded as a stale calculator.** Because Load refused
   his file, he opened the saved .html directly, edited a trib length, and read
   the unchanged results as "the calculations went stale." The record has no
   scripts by design; nothing announced that.

Fixes (deployed as one commit):
- Free-text stringPatterns on stacked_headers_studs, stacked_shearwall,
  steel_joist_selector and asce716_mwfrs loosened to deny only "<", ">" and
  control characters. Enum/id patterns (web_opening shape, gradebeam zone ids,
  React designations) stay strict.
- buildSnapshot now runs validateModel at SAVE time (MODEL_INVALID, names the
  field) — save/load symmetry is structural now; a file can never again pass
  Save and fail Load on schema grounds.
- Saved records carry an on-screen banner (hidden in print) stating they are
  frozen and pointing to Load on the live site, and record inputs are readonly
  with pointer-events disabled — the "edit the record" trap is closed.
- Adversarial tests restructured: hostile model string blocks at save
  (MODEL_INVALID); hand-edited file still rejected at load (BAD_MODEL); the
  field report's exact label round-trips (B3).

Verified: his unmodified file loads against the fixed build (14 fields, zero
mismatches) and the page still recalculates afterward.

Process note: an earlier attempt to patch the patterns via a bash heredoc
corrupted four calc files with raw NUL bytes (the shell collapsed doubled
backslashes, so a unicode escape that should have stayed literal text was
interpreted and written as real control bytes). Caught by grep flagging the
files as binary; reverted from HEAD and re-applied with the backslash sequences
built programmatically.
