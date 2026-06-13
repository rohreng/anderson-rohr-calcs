// =============================================================================
// ARE Calc State storage adapter — Phase 2 (store-only v1)
// -----------------------------------------------------------------------------
// Persists the full Calc State envelope (docs/calc-state-spec.md §6).
//
// Backend selection (decided at call time, never throws on import):
//   1. Postgres  — used when POSTGRES_URL is set AND the `pg` driver is
//      installed. Table `calc_instances` is auto-created on first use.
//   2. JSON file — dev fallback at .data/calc-instances.json when Postgres is
//      unavailable, so the round-trip works today without a DB or `npm install`.
//
// `pg` is imported dynamically inside a try/catch — if it is not installed the
// adapter degrades to the file store rather than crashing the route.
// =============================================================================

import { promises as fs } from "node:fs";
import path from "node:path";

// ── Public shape ────────────────────────────────────────────────────────────

/**
 * The full Calc State envelope. Validation lives in the route handler; the
 * store treats it as an opaque JSON object keyed by its own `id`.
 */
export type CalcState = {
  schema: string;
  calcType: string;
  id?: string | null;
  member?: unknown;
  demands?: unknown;
  geometry?: unknown;
  connection?: unknown;
  results?: unknown;
  meta?: unknown;
  [key: string]: unknown;
};

export interface SaveCalcStateInput {
  /** Server-assigned uuid. Caller generates it and stamps it into `state.id`. */
  id: string;
  /** Discriminator slug, mirrored into the `calc_type` column for filtering. */
  calcType: string;
  /** The complete envelope (already carrying its own `id` and `results`). */
  state: CalcState;
}

// ── Backend resolution ──────────────────────────────────────────────────────

type PgPool = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
};

let pgPoolPromise: Promise<PgPool | null> | null = null;
let tableReady = false;

const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS calc_instances (
    id          uuid PRIMARY KEY,
    calc_type   text NOT NULL,
    state       jsonb NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  );
`;

/**
 * Resolve a Postgres pool, or null if Postgres is unavailable for any reason
 * (no POSTGRES_URL, `pg` not installed, or connection construction failed).
 * Memoized so the dynamic import + pool creation happen at most once.
 */
async function getPgPool(): Promise<PgPool | null> {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) return null;

  if (!pgPoolPromise) {
    pgPoolPromise = (async () => {
      try {
        // Dynamic import guarded so a missing `pg` package does not crash the
        // module graph at build/import time. Webpack ignores the unresolved
        // dependency at build; it is only required at runtime when configured.
        const pg = (await import(/* webpackIgnore: true */ "pg")) as unknown as {
          Pool: new (config: { connectionString: string; ssl?: unknown }) => PgPool;
        };
        const Pool = pg.Pool ?? (pg as { default?: { Pool: typeof pg.Pool } }).default?.Pool;
        if (!Pool) return null;

        const pool = new Pool({
          connectionString,
          // Managed Postgres (Neon / Supabase / Vercel) requires TLS. Allow the
          // platform CA without pinning so it works across providers.
          ssl: { rejectUnauthorized: false },
        });
        return pool as PgPool;
      } catch {
        // `pg` not installed or failed to load — fall back to the file store.
        return null;
      }
    })();
  }

  return pgPoolPromise;
}

async function ensureTable(pool: PgPool): Promise<void> {
  if (tableReady) return;
  await pool.query(CREATE_TABLE_SQL);
  tableReady = true;
}

// ── File-store fallback ─────────────────────────────────────────────────────

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "calc-instances.json");

type FileStoreShape = Record<
  string,
  { id: string; calc_type: string; state: CalcState; created_at: string }
>;

async function readFileStore(): Promise<FileStoreShape> {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw) as FileStoreShape;
  } catch {
    // Missing file or unparseable content → start empty.
    return {};
  }
}

async function writeFileStore(store: FileStoreShape): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Persist a Calc State. Returns the id it was stored under.
 * Uses Postgres when configured, otherwise the local JSON file store.
 */
export async function saveCalcState(input: SaveCalcStateInput): Promise<{ id: string }> {
  const { id, calcType, state } = input;

  const pool = await getPgPool();
  if (pool) {
    await ensureTable(pool);
    await pool.query(
      `INSERT INTO calc_instances (id, calc_type, state)
       VALUES ($1, $2, $3::jsonb)
       ON CONFLICT (id) DO UPDATE SET calc_type = EXCLUDED.calc_type, state = EXCLUDED.state`,
      [id, calcType, JSON.stringify(state)]
    );
    return { id };
  }

  // File fallback
  const store = await readFileStore();
  store[id] = {
    id,
    calc_type: calcType,
    state,
    created_at: new Date().toISOString(),
  };
  await writeFileStore(store);
  return { id };
}

/**
 * Fetch a saved Calc State by id, or null if it does not exist.
 */
export async function getCalcState(id: string): Promise<CalcState | null> {
  const pool = await getPgPool();
  if (pool) {
    await ensureTable(pool);
    const res = await pool.query(
      `SELECT state FROM calc_instances WHERE id = $1 LIMIT 1`,
      [id]
    );
    const row = res.rows[0] as { state: CalcState } | undefined;
    return row ? row.state : null;
  }

  // File fallback
  const store = await readFileStore();
  const entry = store[id];
  return entry ? entry.state : null;
}
