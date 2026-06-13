# ARE Calc State v1 — Phase 0 Contract Specification

*Anderson Rohr Engineering · Revit ↔ Web Calculator Integration · Prepared 2026-06-12*

This is the single source of truth for **three independent build tracks** that must
interoperate without seeing each other's code:

1. **Renderer** — the parametric SVG diagram engine (`are-draw.js`) that consumes a Calc State.
2. **API** — the Next.js route handlers (`/api/calc/run`, `/api/calc/[id]`) + persistence.
3. **pyRevit** — the "Send to Calculator" ribbon button that reads `ARE_*` params, builds a
   Calc State, POSTs it, and writes the result back.

If anything here is ambiguous, **stop and ask** — do not invent field names or units.

Companion files:
- `docs/calc-state.schema.json` — machine-readable JSON Schema (draft 2020-12). Validate against it.
- `docs/examples/*.example.json` — one ready-to-use instance per flagship calc, using each calc's real defaults.
- `revit/ARE_StructCalc.txt` — the Revit shared-parameter file (load via Manage → Shared Parameters).

---

## 0. Scope of v1

- **Three flagship calc types** are in scope. Their slugs (from `app/lib/calcs.ts`) are the `calcType` discriminator:
  | `calcType` | Calc | HTML file | Spec |
  |---|---|---|---|
  | `w-to-hss-column`  | W-Beam to HSS Column (DG24 Ex 4.3) | `W_beam_to_HSS_column_calculator.html` | AISC 360-22 §K1.3 Eq. K1-7 |
  | `base-plate`       | Column Base Plate (RISA table import / DG1) | `column_base_plate_v3.html` | AISC DG1 + ACI 318-19 Ch.17 |
  | `hss-to-hss-branch`| HSS-to-HSS Branch T/Y/X (+truss) | `HSS_to_HSS_branch_connection_calculator.html` | AISC 360-22 Ch.K / DG24 |
- **v1 is store-only.** The API persists the Calc State and returns an `id` + `url`. The
  `dcr`/`status`/`governing`/`computedAt` fields **may be null** until a server-side engine
  exists for that calcType. Revit writes `ARE_Status = PENDING` and a real `ARE_CalcURL` in v1;
  the live DCR comes in a later phase (master plan §6c Option A).

---

## 1. The envelope

Every Calc State is one JSON object with this shape (see schema for full constraints):

```jsonc
{
  "schema":   "are.calc.v1",        // literal discriminator, required
  "calcType": "w-to-hss-column",    // one of the three slugs, required
  "id":       "uuid | null",        // server-assigned; null/absent on POST input
  "member":   { ... },              // the designed element, required
  "demands":  { ... },              // factored LRFD demands, required
  "geometry": { ... },              // member span/Lb/Cb (optional for pure connections)
  "connection": { ... },            // PER-calcType detail block (see §3)
  "results":  { ... },              // written by engine; may be null in v1
  "meta":     { ... }               // provenance (optional)
}
```

### 1.1 `member` — the designed element
| Field | Type | Units | Notes |
|---|---|---|---|
| `member.mark` | string\|null | — | Revit element Mark. |
| `member.type` | enum\|null | — | `beam`, `column`, `wall`, `connection`, `brace`. |
| `member.section` | string **(required)** | — | **AISC manual label, UPPERCASE.** See §2. |
| `member.material.Fy` | number | **ksi** | Yield. |
| `member.material.Fu` | number | **ksi** | Tensile (optional). |
| `member.material.E` | number | **ksi** | Default `29000`. |

`member.section` is the **primary/designed** member for the calcType:
- `w-to-hss-column` → the **W-beam** (the HSS column goes in `connection.column`).
- `base-plate` → the **column** (W or HSS).
- `hss-to-hss-branch` → the **branch** (the chord goes in `connection.chord`).

### 1.2 `demands` — factored LRFD design forces
| Field | Type | Units | Notes |
|---|---|---|---|
| `demands.Mu` | number\|null | **kip-ft** for `w-to-hss-column` & `base-plate`; **kip-in** for `hss-to-hss-branch` | ⚠ Unit differs by calcType — see §4.1. |
| `demands.Mu_op` | number\|null | **kip-in** | Out-of-plane moment, `hss-to-hss-branch` only. |
| `demands.Vu` | number\|null | **kips** | Factored shear. |
| `demands.Pu` | number\|null | **kips** | Factored axial; **compression positive**. |
| `demands.Tu` | number\|null | **kip-in** | Torsion (optional, rarely used). |

### 1.3 `geometry` — member-level geometry (all lengths INCHES)
| Field | Type | Units | Notes |
|---|---|---|---|
| `geometry.L` | number\|null | **in** | Member span/length. |
| `geometry.Lb` | number\|null | **in** | Unbraced length. |
| `geometry.Cb` | number\|null | — | LTB modification factor. |

For the three flagship **connection** calcs, `geometry` is typically empty `{}` — they are
section-level limit-state checks, not member-stability checks. It is carried for forward
compatibility with member calcs and for the `ARE_Span`/`ARE_Lb` Revit params.

### 1.4 `results` — written by the engine
| Field | Type | Units | Notes |
|---|---|---|---|
| `results.governing` | string\|null | — | Governing limit state text. |
| `results.dcr` | number\|null | — | Governing demand/capacity ratio. **null in store-only v1.** |
| `results.status` | enum\|null | — | `PASS` / `FAIL` / `PENDING` / null. |
| `results.url` | string\|null | URI | Permanent saved-calc URL (§5.3). |
| `results.computedAt` | string\|null | ISO-8601 | Timestamp of last engine run. |
| `results.checks[]` | array | — | Optional per-limit-state breakdown (name, ref, demand, capacity, dcr, status). |

---

## 2. Section keys — `member.section` and all `*.section` fields

**The key format is the AISC v16.0 `AISC_Manual_Label`, UPPERCASE, exactly.**

Examples: `W18X50`, `W16X57`, `HSS10X10X1/2`, `HSS12X4X3/8`, `HSS10.000X0.500` (round).

> ⚠ **Surprise the renderer + pyRevit MUST know:** the repo's
> `public/data/aisc-shapes-v16.json` contains **only W, M, S, HP** shapes (355 entries).
> **It has NO HSS, no round HSS, no angles.** The calc HTML files load HSS geometry at
> runtime from `public/Calcs/aisc-shapes-database-v16.0.xlsx` (full v16.0 DB, 714 HSS rows),
> keyed by the same `AISC_Manual_Label`.
>
> Consequences:
> - The **renderer** cannot get HSS dimensions from the JSON. It must either (a) be handed the
>   resolved geometry in the Calc State, or (b) parse the xlsx / a server-provided HSS lookup.
>   Recommended: the API resolves section → geometry server-side and the renderer reads a
>   normalized geometry sub-object if present; otherwise the renderer parses the label
>   (`HSS10X10X1/2` → H=10, B=10, t=0.465 via the nominal→tdes table) for HSS.
> - **pyRevit** must normalize Revit type names to this exact label format
>   (uppercase, fraction wall thickness like `1/2`, round HSS as `OD.000xWALL`). See §6.2.

The in-calc fallback dictionaries inside the HTML use **lowercase-x** keys (`HSS10x10x1/2`,
`W16x57`). **Do NOT emit those** in the Calc State — always emit the uppercase `AISC_Manual_Label`.
The calcs' own loaders match case-insensitively when the xlsx is loaded.

---

## 3. Per-`calcType` `connection` block

The `connection` object is selected by `calcType` (JSON Schema enforces this via `allOf/if/then`).

### 3.1 `w-to-hss-column`
```jsonc
"connection": {
  "column": { "section": "HSS10X10X1/2", "Fy": 46 },  // HSS chord; Fy default 46, LIMIT <= 52 ksi (K1.3)
  "beamFy": 50                                          // beam flange Fyb, ksi (A992 default)
}
```
- `member.section` is the W-beam; `connection.column.section` is the HSS.
- The calc converts `Mu` to a flange-force couple `Puf = Mu·12 / (d − tf)` and checks HSS wall
  local yielding (Eq. K1-7). **Only inputs are: W-section, HSS-section, beamFy, columnFy, Mu.**
  There are no plate/bolt/weld inputs in this calc — the `connection.plate/bolts/weld` keys
  from the master-plan draft are **NOT used** for this calcType.

### 3.2 `base-plate`
```jsonc
"connection": {
  "plate":    { "N": 14, "B": 14, "tp": 0.75, "Fyp": 36 },        // inches; Fyp ksi (A36)
  "anchors":  { "n": 4, "dia": 0.75, "gauge": 11, "grade": "F1554 Gr.36" },  // dia & gauge in inches
  "concrete": { "fc": 3, "hef": 8, "cEdge": 18 }                  // fc ksi; hef & cEdge inches
}
```
- `member.section` is the column (W or HSS).
- `demands` for base-plate: `Pu` (k), `Vu` (k), `Mu` (**k-ft**). The live calc derives `Vu`/`Mu`
  as the max abs across RISA Vy/Vz and Myy/Mzz; for a single Revit member, pass the controlling
  resultants directly.
- Anchor `dia` valid set: 0.75, 0.875, 1.0, 1.125, 1.25, 1.5 (in). `grade` default `F1554 Gr.36`
  (Fut = 58 ksi). Defaults if omitted: `hef`=8, `cEdge`=18, `Fyp`=36, A2/A1=4 (pedestal).
- Output checks (→ `results.checks[]`): Bearing, Plate-C (plate thickness compression),
  Shear, Bolt-T (anchor steel tension), T+V interaction, Conc-T (ACI breakout+pullout),
  Conc-V (ACI breakout+pryout). `results.governing` = worst of these.

### 3.3 `hss-to-hss-branch`
```jsonc
"connection": {
  "subType":  "rect-moment",          // rect-moment | round-moment | truss
  "connType": "T",                    // T | Y | X | KG | KO
  "chord":    { "section": "HSS4X4X3/8", "Fy": 46 },  // through member
  "branchFy": 46,
  "theta":    90,                     // degrees, branch-to-chord
  "Qf":       1.00,                   // chord stress interaction factor
  "orient":   "H",                    // rect branch in-plane axis: H (strong) | B (weak)
  "gap":      null,                   // K-gap, in (negative = overlap); truss/K only
  "overlap":  null                    // Ov %, overlapped-K only
}
```
- `member.section` is the **branch**; `connection.chord.section` is the through member.
- This calc has **three tabs / engine paths** selected by `subType`:
  - `rect-moment` — Rectangular Moment T/Y/X. Demands: `Pu` (k), `Vu` (k), `Mu`=Mu,ip (**kip-in**), `Mu_op` (**kip-in**). Defaults θ=90, Qf=1.00, Fy=Fyb=46.
  - `round-moment` — Round Moment T/Y/X. Demands: `Pu` (k), `Mu`=Mu,ip (**kip-in**), `Mu_op` (**kip-in**). Defaults Fy=Fyb=42. Round chord/branch sections use `OD.000xWALL` labels.
  - `truss` — axial only (§K2). Demands: `Pu` (k) on branch(es). Uses `connType` K-gap/overlap.
- ⚠ **Moments here are kip-IN, not kip-ft.** This is the single biggest unit gotcha. See §4.1.

---

## 4. Units — authoritative table

**Calc-side units (what the JSON carries and the calcs consume):**

| Quantity | Unit | Applies to |
|---|---|---|
| Force (axial, shear, flange force) | **kips** | all |
| Moment | **kip-ft** | `w-to-hss-column`, `base-plate` |
| Moment | **kip-in** | `hss-to-hss-branch` (`Mu`, `Mu_op`) |
| Length / member span / Lb | **inches** | `geometry.*` |
| Plate, anchor, embedment, edge, gauge dims | **inches** | `connection.*` |
| Stress (Fy, Fu, Fyp, E, f'c) | **ksi** | all |
| Angle (theta) | **degrees** | `hss-to-hss-branch` |
| Ratios (dcr, Cb, Qf, beta) | **dimensionless** | all |
| Timestamps | **ISO-8601 UTC** | `results.computedAt`, `ARE_CalcDate` |

### 4.1 ⚠ Moment-unit hazard
`demands.Mu` means **kip-ft** for `w-to-hss-column` and `base-plate`, but **kip-in** for
`hss-to-hss-branch`. The pyRevit builder and the API validator must branch on `calcType`.
Recommendation: pyRevit always stores `ARE_Mu` in **kip-ft** at the Revit param level (consistent
for users), and the **pyRevit JSON builder multiplies by 12** when `calcType == hss-to-hss-branch`
before emitting `demands.Mu`. Document this conversion at the call site so it is not lost.

### 4.2 Revit-internal → calc-unit conversions (pyRevit must apply)
Revit stores everything in **internal units** (feet, and force in internal units). Convert with
the Revit API `UnitUtils.ConvertFromInternalUnits` to the documented unit, **then** to the calc unit:

| Revit param | Revit display unit (recommended) | Calc-unit (JSON) | Conversion to JSON |
|---|---|---|---|
| `ARE_Mu` | kip-ft | kip-ft (or kip-in for hss-to-hss) | identity; ×12 if `hss-to-hss-branch` |
| `ARE_Vu` | kips | kips | identity |
| `ARE_Pu` | kips | kips | identity |
| `ARE_Span` | feet (Revit length) | inches | × 12 |
| `ARE_Lb` | feet (Revit length) | inches | × 12 |
| `ARE_Section` | text | text | normalize to AISC_Manual_Label (§6.2) |
| `ARE_CalcType` | text | text | identity (must be a valid slug) |

> Set the `ARE_Mu/Vu/Pu` shared params to Revit "Number" type and have the user enter values in
> kip-ft / kips directly (they come from the analysis package, not Revit's structural analysis),
> OR map them from analytical results. The pyRevit code owns this; the contract only requires the
> **JSON units in the table above**.

---

## 5. API contract

Two routes, added under `app/api/calc/` in the existing Next.js 16 app.

> ⚠ **Middleware note (must-fix for the API agent):** `middleware.ts` runs `clerkMiddleware`
> and `auth.protect()` on **everything except `/sign-in`**, and the matcher explicitly includes
> `/(api|trpc)(.*)`. As written, an unauthenticated machine POST to `/api/calc/run` is blocked
> by Clerk before the route runs. The API agent must update the middleware to treat
> `/api/calc/(.*)` as a route where **either** a valid Clerk session **or** a valid `x-api-key`
> is accepted — i.e. add `/api/calc/(.*)` to a public-route set and perform auth inside the
> handler (see §5.4). Do not remove Clerk protection from the rest of the app.

### 5.1 `POST /api/calc/run`
- **Body:** a Calc State **without** `id` and (typically) without populated `results`. Must
  validate against `calc-state.schema.json`. Reject with `400` + `{ error, details }` on
  schema failure.
- **Behavior (v1, store-only):**
  1. Validate.
  2. Generate a UUID `id`.
  3. If a server-side engine exists for `calcType`, run it and populate `results`. Otherwise set
     `results = { governing:null, dcr:null, status:"PENDING", computedAt:null, url:<computed> }`.
  4. Persist the full Calc State (with `id`, `url`) to `calc_instances`.
  5. Return:
     ```json
     { "id": "<uuid>", "url": "https://calcs.andersonrohr.com/calcs/<slug>?id=<uuid>",
       "dcr": null, "status": "PENDING" }
     ```
- `dcr` and `status` echo `results.dcr` / `results.status` (may be null / "PENDING" in v1).

### 5.2 `GET /api/calc/[id]`
- Returns the **full saved Calc State** JSON (envelope with `id` + `results` populated) for that
  `id`, or `404` if not found.
- Used by the slug page to pre-load a saved instance (§5.3) and by Revit/QA to re-fetch.

### 5.3 Saved-calc URL format
```
https://calcs.andersonrohr.com/calcs/<slug>?id=<uuid>
```
- `<slug>` = `calcType`. `<uuid>` = `id`.
- The slug page (`app/(main)/calcs/[slug]/page.tsx`) currently renders the calc HTML in an
  `<iframe src={calc.htmlFile}>`. To support `?id=`, the page should pass the id into the iframe
  (e.g. `src={calc.htmlFile + "?id=" + id}`) and the calc HTML / `are-utils-v2.js` should
  `GET /api/calc/[id]`, hydrate inputs, and auto-run. **Wiring the iframe hydration is the
  renderer/API tracks' job, not Phase 0** — this spec only fixes the URL shape and the GET payload.

### 5.4 Auth
- **Machine clients (pyRevit):** header `x-api-key: <token>` checked against env `ARE_API_KEY`.
  Constant-time compare. On mismatch/absence (and no Clerk session) → `401`.
- **Human clients (browser):** existing Clerk session is accepted.
- The handler accepts the request if **(valid Clerk session) OR (x-api-key === ARE_API_KEY)**.
- The key must be scoped to the calc routes and revocable by rotating `ARE_API_KEY`. Never embed
  Clerk user credentials in the add-in.

---

## 6. Storage decision

**Postgres via a thin adapter, with a local JSON-file fallback for dev.**

- **Env:** `POSTGRES_URL`. Works with Vercel Postgres / Neon **or** Supabase (both speak the same
  `postgres://...` connection string). The adapter only needs the connection string — no
  provider-specific SDK. (Recommended driver: `postgres` or `@vercel/postgres`; the API agent picks one.)
- **Dev fallback:** if `POSTGRES_URL` is unset, persist to a local JSON file
  (e.g. `.data/calc-instances.json`, gitignored) so the round-trip works without a DB.
- **One table:**
  ```sql
  CREATE TABLE IF NOT EXISTS calc_instances (
    id          uuid PRIMARY KEY,
    calc_type   text NOT NULL,
    state       jsonb NOT NULL,   -- the full Calc State envelope
    created_at  timestamptz NOT NULL DEFAULT now()
  );
  ```
- `state` holds the entire envelope (including its own `id`/`results`), so a single read
  reconstructs everything. `calc_type` is duplicated as a column only for cheap filtering.

---

## 7. Revit parameter mapping table

Shared-parameter file: `revit/ARE_StructCalc.txt` (load via Manage → Shared Parameters →
Browse). Bind to categories: **Structural Framing, Structural Columns, Walls**.

| Revit shared param | DATATYPE | Group | Dir | JSON field | Calc unit |
|---|---|---|---|---|---|
| `ARE_Mu` | NUMBER | ARE Calc Inputs | in | `demands.Mu` | kip-ft (×12 → kip-in for hss-to-hss) |
| `ARE_Vu` | NUMBER | ARE Calc Inputs | in | `demands.Vu` | kips |
| `ARE_Pu` | NUMBER | ARE Calc Inputs | in | `demands.Pu` | kips |
| `ARE_Span` | NUMBER | ARE Calc Inputs | in | `geometry.L` | inches (Revit ft ×12) |
| `ARE_Lb` | NUMBER | ARE Calc Inputs | in | `geometry.Lb` | inches (Revit ft ×12) |
| `ARE_Section` | TEXT | ARE Calc Inputs | in | `member.section` | AISC_Manual_Label (UPPER) |
| `ARE_CalcType` | TEXT | ARE Calc Inputs | in | `calcType` | slug |
| `ARE_DCR` | NUMBER | ARE Calc Writeback | out | `results.dcr` | dimensionless |
| `ARE_Status` | TEXT | ARE Calc Writeback | out | `results.status` | PASS/FAIL/PENDING |
| `ARE_CalcURL` | URL | ARE Calc Writeback | out | `results.url` | URI |
| `ARE_CalcDate` | TEXT | ARE Calc Writeback | out | `results.computedAt` | ISO-8601 |

`ARE_CalcType` must be one of: `w-to-hss-column`, `base-plate`, `hss-to-hss-branch`.

### 6.1 Which secondary member?
`ARE_Section` carries only the **primary/designed** member (§1.1). For the connection's
**secondary** member (HSS column, base plate config, HSS chord), v1 has no dedicated Revit param —
the pyRevit button must supply it from a button-side mapping / dialog, or from a sibling element.
This is a known v1 limitation; full connection-geometry params are a later phase.

### 6.2 Section-name normalization (pyRevit)
Revit type names vary (`HSS10X10X1/2`, `HSS10x10x1/2`, `HSS 10X10X1/2`, `HSS10X10X.500`).
Normalize to `AISC_Manual_Label`:
1. Uppercase; strip spaces.
2. Wall thickness as a fraction in eighths/sixteenths (`1/2`, `5/16`, `3/8`), **not** a decimal.
3. Round HSS as `OD.000xWALL` → `HSS10.000X0.500` (note the three-decimal OD and the literal `X`).
4. Validate the result is a key present in the AISC v16.0 DB before POSTing; if not found, fail
   loudly so the user fixes the type name rather than silently sending an unresolvable section.

---

## 8. Validation checklist (all tracks)

- [ ] JSON validates against `docs/calc-state.schema.json`.
- [ ] `member.section` (and all `*.section`) are UPPERCASE AISC_Manual_Labels.
- [ ] Moment units correct **per calcType** (kip-ft vs kip-in) — §4.1.
- [ ] POST body has no `id`; response `url` matches §5.3 exactly.
- [ ] Auth: machine path uses `x-api-key`/`ARE_API_KEY`; humans use Clerk; middleware updated.
- [ ] `results.status` defaults to `PENDING` in store-only v1 (never silently `PASS`).
```
