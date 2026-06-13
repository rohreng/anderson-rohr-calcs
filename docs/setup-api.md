# ARE Calc API — Setup Runbook (Phase 2)

*Anderson Rohr Engineering · Revit ↔ Web Calculator integration*

This runbook gets the `/api/calc/*` persistence routes running locally and on
Vercel. The API is **store-only v1**: it persists a Calc State and returns an
`id` + permanent URL. `results.status` is always `"PENDING"` and `results.dcr`
is `null` (no server-side calc engine yet — that is a later phase).

> **No Postgres? It still works.** If `POSTGRES_URL` is unset (or the `pg`
> driver isn't installed), the adapter automatically falls back to a local JSON
> file at `.data/calc-instances.json` (gitignored). You can develop and smoke-
> test the full round-trip today without provisioning a database. Set up
> Postgres when you're ready for shared/production persistence.

---

## What was built

| File | Purpose |
|---|---|
| `app/lib/calc-store.ts` | Storage adapter: Postgres (dynamic `pg` import, auto-creates `calc_instances`) with a JSON-file fallback. |
| `app/lib/calc-api.ts` | Shared auth (Clerk session **or** `x-api-key`) + lightweight structural validation. |
| `app/api/calc/run/route.ts` | `POST /api/calc/run` — validate, assign uuid, stamp PENDING results, persist, return `{ id, url, dcr, status }`. |
| `app/api/calc/[id]/route.ts` | `GET /api/calc/[id]` — return the saved envelope, or 404. |
| `public/are-state-loader.js` | Browser helper: reads `?id=`, fetches the state, dispatches `are:stateLoaded`. |
| `middleware.ts` | Exempts `/api/calc(.*)` from Clerk `auth.protect()` (handlers self-authorize). |

---

## 1. Provision Postgres (production / shared dev)

Pick **one**. Both speak the standard `postgres://…` connection string; the
adapter needs nothing provider-specific.

### Option A — Neon via the Vercel Marketplace (recommended)
1. Vercel dashboard → your project → **Storage** → **Create Database** →
   **Neon** (Postgres). Accept the defaults.
2. Vercel auto-injects a `POSTGRES_URL` (and related vars) into the project's
   environment. Pull it locally with `vercel env pull .env.local` (or copy the
   `POSTGRES_URL` value from the Storage tab).

### Option B — Supabase
1. Create a project at supabase.com.
2. **Project Settings → Database → Connection string → URI**. Use the
   connection-pooler URI for serverless (port `6543`).
3. Copy it as `POSTGRES_URL`.

> The adapter connects with `ssl: { rejectUnauthorized: false }`, which both
> Neon and Supabase require.

---

## 2. Environment variables

Add these to **`.env.local`** (local dev) **and** to **Vercel → Settings →
Environment Variables** (Production + Preview). `.env*` is gitignored — never
commit secrets.

```bash
# Postgres connection string (omit entirely to use the local JSON file store)
POSTGRES_URL="postgres://USER:PASSWORD@HOST:PORT/DBNAME?sslmode=require"

# Shared secret for machine clients (pyRevit "Send to Calculator" button).
# Rotate this value to revoke all machine access.
ARE_API_KEY="<generate-with-the-command-below>"
```

Generate a strong `ARE_API_KEY`:

```bash
# Node (cross-platform):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# PowerShell:
[Convert]::ToHexString((1..32 | ForEach-Object {Get-Random -Max 256})).ToLower()

# macOS/Linux:
openssl rand -hex 32
```

---

## 3. Install the Postgres driver

Only needed if you're using Postgres (skip for the file-store fallback).
Run this yourself — installs are not done by the agent (node_modules lives on
OneDrive).

```bash
npm install pg
```

The adapter imports `pg` dynamically inside a try/catch, so the app still builds
and runs (on the file fallback) even before this is installed.

---

## 4. Create the table (auto-created on first use)

The adapter runs `CREATE TABLE IF NOT EXISTS` on the first request, so no manual
step is strictly required. To create it by hand (e.g. to verify access):

```sql
CREATE TABLE IF NOT EXISTS calc_instances (
  id          uuid PRIMARY KEY,
  calc_type   text NOT NULL,
  state       jsonb NOT NULL,   -- the full Calc State envelope
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

---

## 5. Smoke tests (curl)

Run `npm run dev` first (default `http://localhost:3000`). For production,
swap the base URL for `https://calcs.andersonrohr.com`.

### 5a. POST with a valid `x-api-key` → **201**

```bash
curl -i -X POST http://localhost:3000/api/calc/run \
  -H "Content-Type: application/json" \
  -H "x-api-key: $ARE_API_KEY" \
  --data-binary @docs/examples/w-to-hss-column.example.json
```

Expected: `201 Created` with a body like:

```json
{
  "id": "…uuid…",
  "url": "https://calcs.andersonrohr.com/calcs/w-to-hss-column?id=…uuid…",
  "dcr": null,
  "status": "PENDING"
}
```

> The example file carries its own `id`; the server **ignores** it and assigns a
> fresh uuid. Grab the returned `id` for the GET below.

### 5b. POST WITHOUT `x-api-key` (and no Clerk session) → **401**

```bash
curl -i -X POST http://localhost:3000/api/calc/run \
  -H "Content-Type: application/json" \
  --data-binary @docs/examples/w-to-hss-column.example.json
```

Expected: `401 Unauthorized`.

### 5c. POST with a bad body → **400 / 422**

```bash
# Not JSON → 400
curl -i -X POST http://localhost:3000/api/calc/run \
  -H "x-api-key: $ARE_API_KEY" -H "Content-Type: application/json" \
  --data 'not json'

# Structured but invalid (unknown calcType) → 422
curl -i -X POST http://localhost:3000/api/calc/run \
  -H "x-api-key: $ARE_API_KEY" -H "Content-Type: application/json" \
  --data '{"schema":"are.calc.v1","calcType":"nope","member":{"section":"W16X57"},"demands":{}}'
```

### 5d. GET with `x-api-key` → **200** (full envelope)

```bash
curl -i http://localhost:3000/api/calc/<ID-FROM-5a> \
  -H "x-api-key: $ARE_API_KEY"
```

Expected: `200 OK`, body is the full saved Calc State (with `id` and the
`PENDING` `results` block populated).

### 5e. GET without auth → **401**; unknown id with auth → **404**

```bash
# No auth → 401
curl -i http://localhost:3000/api/calc/<ID-FROM-5a>

# Unknown id, authorized → 404
curl -i http://localhost:3000/api/calc/00000000-0000-0000-0000-000000000000 \
  -H "x-api-key: $ARE_API_KEY"
```

> **PowerShell note:** use `curl.exe` (not the `curl` alias for
> `Invoke-WebRequest`), and quote header values, e.g.
> `curl.exe -i -X POST "http://localhost:3000/api/calc/run" -H "x-api-key: $env:ARE_API_KEY" ...`.

---

## 6. How auth works (reference)

`middleware.ts` adds `/api/calc(.*)` to the Clerk public-route matcher, so
`auth.protect()` does **not** block these routes. Each handler then enforces:

> **authorized = (valid Clerk session) OR (`x-api-key` === `ARE_API_KEY`)**

- **pyRevit / machine clients** send `x-api-key`. Rotate `ARE_API_KEY` to revoke.
- **Browser users** are covered by their existing Clerk session cookie — which
  is why the same-origin iframe GET (`are-state-loader.js`) works for a
  logged-in user with no extra header.

The rest of the app stays fully Clerk-protected.

---

## 7. Follow-up (not in this phase)

- Wire each calc HTML page to **consume** the `are:stateLoaded` event
  (map `state.member` / `state.demands` / `state.connection` to inputs and
  auto-run). The loader only fetches + broadcasts today.
- Add the server-side calc engine so `results.dcr` / `status` become real.
