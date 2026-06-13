// =============================================================================
// GET /api/calc/[id] — fetch a saved Calc State (store-only v1)
// -----------------------------------------------------------------------------
// Spec: docs/calc-state-spec.md §5.2.
//   • Auth: valid Clerk session OR x-api-key === ARE_API_KEY (§5.4).
//   • Returns the full saved envelope (id + results populated), or 404.
//
// In Next.js 16, the route handler's `context.params` is a Promise and must be
// awaited (changed in v15).
// =============================================================================

import type { NextRequest } from "next/server";
import { authorizeCalcRequest } from "../../../lib/calc-api";
import { getCalcState } from "../../../lib/calc-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Auth (same gate as POST — the iframe carries the user's Clerk cookie).
  if (!(await authorizeCalcRequest(request))) {
    return Response.json(
      { error: "Unauthorized. Provide a valid Clerk session or x-api-key." },
      { status: 401 }
    );
  }

  const { id } = await params;

  const state = await getCalcState(id);
  if (!state) {
    return Response.json({ error: "Calc State not found", id }, { status: 404 });
  }

  return Response.json(state, { status: 200 });
}
