// =============================================================================
// Shared helpers for the /api/calc/* route handlers
// -----------------------------------------------------------------------------
//  • authorizeCalcRequest — accepts EITHER a valid Clerk session OR a valid
//    x-api-key header (constant-time compared against ARE_API_KEY). Spec §5.4.
//  • validateCalcState — lightweight structural validation against the v1
//    contract (docs/calc-state-spec.md §1, calc-state.schema.json). No heavy
//    deps: just the required envelope fields, a known calcType slug, and
//    numeric demands/geometry.
// =============================================================================

import { auth } from "@clerk/nextjs/server";
import { CALCS } from "./calcs";
import type { CalcState } from "./calc-store";

// ── Auth ─────────────────────────────────────────────────────────────────────

/** Timing-safe string comparison without pulling in node:crypto's Buffer dance. */
function safeEqual(a: string, b: string): boolean {
  // Compare against a fixed-length transform so length itself does not leak via
  // early return. Not as strong as crypto.timingSafeEqual but adequate here and
  // dependency-free for the edge/runtime-agnostic handler.
  if (typeof a !== "string" || typeof b !== "string") return false;
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Returns true if the request is authorized to use the calc API:
 *   (valid Clerk session) OR (x-api-key === ARE_API_KEY).
 * The middleware exempts /api/calc(.*) from Clerk's auth.protect(), so this is
 * the sole gate for these routes.
 */
export async function authorizeCalcRequest(request: Request): Promise<boolean> {
  // 1. Machine clients: x-api-key header.
  const apiKey = request.headers.get("x-api-key");
  const expected = process.env.ARE_API_KEY;
  if (apiKey && expected && safeEqual(apiKey, expected)) {
    return true;
  }

  // 2. Human clients: existing Clerk session cookie.
  try {
    const { userId } = await auth();
    if (userId) return true;
  } catch {
    // auth() can throw if Clerk context is unavailable; treat as unauthenticated.
  }

  return false;
}

// ── Validation ───────────────────────────────────────────────────────────────

const KNOWN_SLUGS: ReadonlySet<string> = new Set(CALCS.map((c) => c.slug));

// The three flagship calcTypes that the schema discriminates on. The slug set
// above is broader (every calc on the site); the contract restricts POST bodies
// to these three (calc-state.schema.json enum).
const VALID_CALC_TYPES: ReadonlySet<string> = new Set([
  "w-to-hss-column",
  "base-plate",
  "hss-to-hss-branch",
]);

export type ValidationResult =
  | { ok: true; value: CalcState }
  | { ok: false; error: string; details: string[] };

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** number | null is acceptable for demand/geometry fields. */
function isNumberOrNull(v: unknown): boolean {
  return v === null || (typeof v === "number" && Number.isFinite(v));
}

/**
 * Lightweight structural validation of a POST body against the v1 contract.
 * Returns the typed CalcState on success, or a list of human-readable issues.
 */
export function validateCalcState(body: unknown): ValidationResult {
  const details: string[] = [];

  if (!isPlainObject(body)) {
    return { ok: false, error: "Body must be a JSON object", details: ["root is not an object"] };
  }

  // schema discriminator
  if (body.schema !== "are.calc.v1") {
    details.push('schema must equal the literal "are.calc.v1"');
  }

  // calcType — must be a known slug AND one of the three flagship types
  const calcType = body.calcType;
  if (typeof calcType !== "string") {
    details.push("calcType is required and must be a string");
  } else {
    if (!KNOWN_SLUGS.has(calcType)) {
      details.push(`calcType "${calcType}" is not a known calc slug`);
    } else if (!VALID_CALC_TYPES.has(calcType)) {
      details.push(
        `calcType "${calcType}" is not one of the v1 flagship calcs (w-to-hss-column, base-plate, hss-to-hss-branch)`
      );
    }
  }

  // member (required) with a required string section
  const member = body.member;
  if (!isPlainObject(member)) {
    details.push("member is required and must be an object");
  } else if (typeof member.section !== "string" || member.section.trim() === "") {
    details.push("member.section is required and must be a non-empty string");
  }

  // demands (required) — all present force fields must be number | null
  const demands = body.demands;
  if (!isPlainObject(demands)) {
    details.push("demands is required and must be an object");
  } else {
    for (const key of ["Mu", "Mu_op", "Vu", "Pu", "Tu"]) {
      if (key in demands && !isNumberOrNull(demands[key])) {
        details.push(`demands.${key} must be a finite number or null`);
      }
    }
  }

  // geometry (optional) — if present, fields must be number | null
  if ("geometry" in body && body.geometry !== undefined) {
    const geometry = body.geometry;
    if (!isPlainObject(geometry)) {
      details.push("geometry, when present, must be an object");
    } else {
      for (const key of ["L", "Lb", "Cb"]) {
        if (key in geometry && !isNumberOrNull(geometry[key])) {
          details.push(`geometry.${key} must be a finite number or null`);
        }
      }
    }
  }

  // connection (optional at this validation tier) — must be an object if present
  if ("connection" in body && body.connection !== undefined && !isPlainObject(body.connection)) {
    details.push("connection, when present, must be an object");
  }

  if (details.length > 0) {
    return { ok: false, error: "Calc State failed validation", details };
  }

  return { ok: true, value: body as CalcState };
}
