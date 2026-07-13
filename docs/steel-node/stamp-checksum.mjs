// stamp-checksum.mjs — deploy-time artifact-checksum stamping per PLAN-STEEL-NODE.md
// ("Report provenance": SHA-256 of the file computed with the checksum field zeroed,
//  written by a deploy-time stamping script and re-verifiable the same way).
//
// The checksum field is the token following "SHA-256: " in the provenance footer.
// Canonical form = the field set to the placeholder "UNSTAMPED". The stamp is the
// SHA-256 (hex) of the canonical file bytes (utf8).
//
//   node docs/steel-node/stamp-checksum.mjs <file...>            stamp (idempotent)
//   node docs/steel-node/stamp-checksum.mjs --verify <file...>   verify, exit 1 on mismatch
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const FIELD = /SHA-256: (UNSTAMPED|[0-9a-f]{64})/;

const args = process.argv.slice(2);
const verify = args[0] === "--verify";
const files = verify ? args.slice(1) : args;
if (!files.length) { console.error("usage: stamp-checksum.mjs [--verify] <file...>"); process.exit(2); }

let fail = 0;
for (const f of files) {
  const raw = readFileSync(f, "utf8");
  const m = raw.match(FIELD);
  if (!m) { console.error(`${f}: NO CHECKSUM FIELD`); fail = 1; continue; }
  const canonical = raw.replace(FIELD, "SHA-256: UNSTAMPED");
  const hash = createHash("sha256").update(canonical, "utf8").digest("hex");
  if (verify) {
    const ok = m[1] === hash;
    console.log(`${ok ? "OK  " : "FAIL"} ${f}\n     embedded=${m[1]}\n     computed=${hash}`);
    if (!ok) fail = 1;
  } else {
    writeFileSync(f, raw.replace(FIELD, `SHA-256: ${hash}`), "utf8");
    console.log(`STAMPED ${f}\n        ${hash}`);
  }
}
process.exit(fail);
