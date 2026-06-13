// =============================================================================
// POST /api/calc/run — persist a Calc State (store-only v1)
// -----------------------------------------------------------------------------
// Spec: docs/calc-state-spec.md §5.1.
//   1. Auth: valid Clerk session OR x-api-key === ARE_API_KEY (§5.4).
//   2. Validate the body structurally against the v1 contract.
//   3. Generate a uuid, stamp results = { status:"PENDING", dcr:null, ... }.
//   4. Persist the full envelope.
//   5. Return { id, url, dcr, status } (201).
//
// No server-side engine exists in v1, so results.status stays "PENDING" and
// results.dcr stays null.
// =============================================================================

import type { NextRequest } from "next/server";
import { authorizeCalcRequest, validateCalcState } from "../../../lib/calc-api";
import { saveCalcState, type CalcState } from "../../../lib/calc-store";

// Persistence + crypto.randomUUID require the Node.js runtime (not Edge).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SAVED_URL_BASE = "https://calcs.andersonrohr.com/calcs";

export async function POST(request: NextRequest) {
  // 1. Auth
  if (!(await authorizeCalcRequest(request))) {
    return Response.json(
      { error: "Unauthorized. Provide a valid Clerk session or x-api-key." },
      { status: 401 }
    );
  }

  // 2. Parse body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid JSON body", details: ["request body is not valid JSON"] },
      { status: 400 }
    );
  }

  // 3. Validate. Malformed envelope (bad types / unknown calcType) → 422;
  //    a totally non-object body is a 400 (handled inside the validator path).
  const result = validateCalcState(body);
  if (!result.ok) {
    // 400 when the body is not even an object; 422 when it is structured but
    // fails the contract.
    const status =
      result.details.length === 1 && result.details[0] === "root is not an object"
        ? 400
        : 422;
    return Response.json({ error: result.error, details: result.details }, { status });
  }

  const input = result.value;

  // 4. Assign id, build saved-calc URL, stamp store-only results.
  const id = crypto.randomUUID();
  const url = `${SAVED_URL_BASE}/${input.calcType}?id=${id}`;
  const computedAt = new Date().toISOString();

  const state: CalcState = {
    ...input,
    id,
    results: {
      governing: null,
      dcr: null,
      status: "PENDING",
      url,
      computedAt,
    },
  };

  // 5. Persist
  try {
    await saveCalcState({ id, calcType: input.calcType, state });
  } catch (err) {
    return Response.json(
      {
        error: "Failed to persist Calc State",
        details: [err instanceof Error ? err.message : String(err)],
      },
      { status: 500 }
    );
  }

  // 6. Respond. dcr/status echo results (null / "PENDING" in store-only v1).
  return Response.json({ id, url, dcr: null, status: "PENDING" }, { status: 201 });
}
