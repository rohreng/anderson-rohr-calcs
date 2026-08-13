/*
 * Deep-beam STM engine fixture runner (PLAN.md §11). No dependencies.
 *   node tools/test-deep-beam-stm.mjs        (or: npm run test:stm)
 *
 * Generic fixtures: { name, comments, runs: [{ name?, inputs, expect }] } where expect carries
 *   status, errorCodes, values: [{path, value, rtol?, atol?, note?}], products: [{a,b,equals,rtol,note?}].
 * Path syntax supports array matching: results.checks[id=tie.bottom].dcr, ...members[id=arch.0].force_kip.
 *
 * authority_example.json (FHWA-NHI-17-071 Ex. 1) is handled by a dedicated adapter below:
 * the document upsized all bearing plates from 12 in to 14 in mid-design, so the fixture is run
 * TWICE (lb = 12 "initial", lb = 14 "final") and each published quantity is compared against the
 * stage it was computed at. z is PINNED at the published 64 in via the test-only engine option
 * (see the fixture's topology_note); capacities are compared only under AASHTO phi/nu factors,
 * computed here from ENGINE GEOMETRY (Acn), exactly as the fixture documents.
 */
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), "..");
const ENGINE = require(path.join(ROOT, "public", "Calcs", "js", "deep_beam_stm_engine.js"));
const FIXDIR = path.join(ROOT, "fixtures", "deep-beam-stm");

let rows = [];
let failures = 0;

function resolvePath(obj, p) {
  p = p.replace(/^checks\[/, "results.checks[");
  const tokens = p.match(/[^.[\]]+|\[[^\]]+\]/g) || [];
  let cur = obj;
  for (const t of tokens) {
    if (cur === undefined || cur === null) return undefined;
    if (t.startsWith("[")) {
      const inner = t.slice(1, -1);
      if (/^\d+$/.test(inner)) cur = cur[Number(inner)];
      else {
        const eq = inner.indexOf("=");
        const k = inner.slice(0, eq), v = inner.slice(eq + 1);
        cur = Array.isArray(cur) ? cur.find(e => e && String(e[k]) === v) : undefined;
      }
    } else cur = cur[t];
  }
  return cur;
}

function compare(fixture, quantity, expected, actual, tol, note) {
  let pass;
  let tolTxt = "";
  if (typeof expected === "number") {
    if (typeof actual !== "number" || !isFinite(actual)) pass = false;
    else if (tol.atol !== undefined && tol.rtol !== undefined) {
      pass = Math.abs(actual - expected) <= Math.max(tol.atol, tol.rtol * Math.abs(expected));
      tolTxt = "atol " + tol.atol + " / rtol " + tol.rtol;
    } else if (tol.atol !== undefined) { pass = Math.abs(actual - expected) <= tol.atol + 1e-12; tolTxt = "atol " + tol.atol; }
    else { const r = tol.rtol !== undefined ? tol.rtol : 1e-9; pass = Math.abs(actual - expected) <= r * Math.abs(expected) + 1e-12; tolTxt = "rtol " + r; }
  } else { pass = actual === expected; tolTxt = "exact"; }
  rows.push({ fixture, quantity: quantity + (note ? " — " + note : ""), expected, actual, tol: tolTxt, pass });
  if (!pass) failures++;
  return pass;
}

function skip(fixture, quantity, reason) {
  rows.push({ fixture, quantity, expected: "-", actual: "SKIP: " + reason, tol: "-", pass: null });
}

function fmtVal(v) {
  if (typeof v === "number") return Math.abs(v) >= 1e6 || (Math.abs(v) < 1e-4 && v !== 0) ? v.toExponential(4) : +v.toFixed(6) + "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function runGeneric(file, fx) {
  const runs = fx.runs || [{ inputs: fx.inputs, expect: fx.expect }];
  runs.forEach((r, i) => {
    const label = path.basename(file, ".json") + (runs.length > 1 ? ":" + (r.name || "run" + (i + 1)) : "");
    let out;
    try { out = ENGINE.run(r.inputs); }
    catch (e) { compare(label, "engine threw", "no exception", String(e && e.stack || e), {}); return; }
    const exp = r.expect || {};
    compare(label, "status", exp.status || "ok", out.status, {});
    if (exp.errorCodes) {
      for (const code of exp.errorCodes) {
        const found = (out.errors || []).some(e => e.code === code);
        compare(label, "error code " + code + " present", true, found, {});
      }
    }
    if (out.status !== (exp.status || "ok")) {
      if ((out.errors || []).length) skip(label, "errors", JSON.stringify(out.errors.map(e => e.code + ":" + e.message)).slice(0, 220));
      return;
    }
    for (const v of exp.values || []) {
      compare(label, v.path, v.value, resolvePath(out, v.path), { rtol: v.rtol, atol: v.atol }, v.note);
    }
    for (const p of exp.products || []) {
      const a = resolvePath(out, p.a), b = resolvePath(out, p.b);
      const prod = (typeof a === "number" && typeof b === "number") ? a * b : NaN;
      compare(label, p.a + " * " + p.b, p.equals, prod, { rtol: p.rtol, atol: p.atol }, p.note);
    }
  });
}

// ---------------------------------------------------------------- FHWA authority adapter
function runAuthority(fx) {
  const label = "authority_example";
  const t = fx.tolerances;
  const pct = s => Number(String(s).match(/[\d.]+/)[0]) / 100;
  const abs = s => Number(String(s).match(/[\d.]+/)[0]);
  const TOL = {
    reactions: { rtol: pct(t.reactions) },
    forces: { rtol: pct(t.member_forces) },
    angles: { atol: abs(t.angles_deg) },
    widths: { atol: abs(t.node_face_widths_in) },
    caps: { rtol: pct(t.node_capacities_phiPn) },
    tie: { rtol: pct(t.tie_capacity) },
    anch: { atol: abs(t.anchorage_lengths_in) }
  };
  const fc = fx.inputs.materials.fc_psi / 1000; // 5 ksi
  const PHI_AASHTO = 0.70, PHI_T_AASHTO = 0.90;

  function build(lb) {
    // overhang from bearing CL = 12 in each end -> e = 12 - lb/2 beyond the bearing outer face
    const e = 12 - lb / 2;
    return {
      geometry: { L_w_ft: 29, x_L_ft: 1, x_R_ft: 28, lb_L_in: lb, lb_R_in: lb, t_w_in: 48, h_w_ft: 4, h_gb_in: 24, b_gb_in: 48, e_L_in: e, e_R_in: e },
      loads: {
        DL_super_plf: 0, LL_plf: 0, wallSW_plf: 0, gbSW_plf: 0, // self weight included in the published point loads
        pointLoads: [
          { x_ft: 10, width_in: lb, D_kip: 600, L_kip: 0 },  // 108 in from left bearing CL
          { x_ft: 19, width_in: lb, D_kip: 600, L_kip: 0 }
        ]
      },
      materials: { fc_psi: 5000, fy_ksi: 60 },
      reinf: {
        tieBars: { count: 16, size: "#10" }, topBars: { count: 6, size: "#8" },
        cover_bot_in: 2, cover_side_in: 2, cover_top_in: 2.5,
        web: { v: { size: "#5", s_in: 8, layers: 4 }, h: { size: "#6", s_in: 12, layers: 4 } },
        anchorage: { left: { type: "hook" }, right: { type: "hook" } }
      },
      options: {
        pinZ_in: 64,           // topology_note: published chord geometry (Whitney-block crown), test-only
        tieCentroid_in: 5,     // published hSTM uses yt = 5 in (4.90 rounded)
        // ---- WHY THE ACI §23.8.2 TIE-WIDTH CAP IS DISABLED FOR THIS FIXTURE ----------------
        // FHWA-NHI-17-071 Example 1 is an AASHTO LRFD Bridge Design Specifications §5.8.2
        // strut-and-tie example. AASHTO carries NO equivalent of ACI 318-19 §23.8.2 (effective
        // tie width w_t <= F_nt/(f_ce*b_s)): its nodal zone is built directly from the tie
        // centroid, and the document's published node C back face is the full ha = 2*yt = 10 in.
        // Under ACI the same section would cap at
        //     w_t,max = F_nt/(f_ce*b_s) = (16*1.27*60)/(0.85*0.80*1.0*5*48)
        //             = 1219.2/163.2 = 7.4706 in  <  10 in,
        // which would change ha, the strut-interface width, Acn and phiPn at node C and make the
        // published values unmatchable. This fixture exists to validate the ENGINE'S TOPOLOGY,
        // STATICS AND NODE GEOMETRY against an independent authority, and it already compares
        // capacities only under AASHTO phi/nu factors for exactly this reason. The cap is
        // switched off here so the whole comparison stays on the document's own code basis
        // instead of mixing two codes inside one check.
        //
        // CONSEQUENCE, STATED EXPLICITLY: this fixture therefore does NOT validate the ACI
        // §23.8.2 effective-tie-width feature in any way, and must not be cited as evidence for
        // it. That feature is validated separately and independently by
        // fixtures/deep-beam-stm/tie_width_band.json, which covers the uncapped case (default,
        // w_t,phys < w_t,max), the capped case (the cap propagating to ha, to the node
        // back-face stress, and to the anchorage critical section xCrit), the multi-layer
        // band-membership failure, and the Case C top-tie capping touchpoints.
        // The ENGINE DEFAULT is tieWidthLimit = true; this adapter is the only place it is off.
        tieWidthLimit: false,
        combos: [{ id: "AASHTO-STR", D: 1.0, L: 0 }] // loads are entered already factored
      }
    };
  }

  const runA = ENGINE.run(build(12)); // "initial" stage: node C, node F initial interface
  const runB = ENGINE.run(build(14)); // "final" stage: node F final interface, anchorage
  compare(label, "run(lb=12) status", "ok", runA.status, {});
  compare(label, "run(lb=14) status", "ok", runB.status, {});
  if (runA.status !== "ok" || runB.status !== "ok") return;
  const mA = runA.results.model, mB = runB.results.model;
  const ex = fx.expected;

  // statics / topology (identical between stages)
  compare(label, "reaction each support", ex.reactions_kips.strength_each_support, mA.RtL_kip, TOL.reactions);
  compare(label, "reaction each support (R)", ex.reactions_kips.strength_each_support, mA.RtR_kip, TOL.reactions);
  skip(label, "service reactions 400 k", "engine runs the strength stage only (loads entered factored)");
  compare(label, "Mu_max", ex.moment.Mu_max_kip_in, mA.Mmax_kin, { rtol: 0.005 });
  compare(label, "springing angle vs strut CF 30.7", ex.angles_deg.strut_CF, mA.thetaL_deg, TOL.angles);
  compare(label, "springing angle right", ex.angles_deg.strut_CF, mA.thetaR_deg, TOL.angles);
  skip(label, "angles AD/BE 49.8", "left-half two-panel demonstration model; funicular canon uses the direct strut (fixture topology_note)");

  const memA = id => resolvePath(runA, "results.model.members[id=" + id + "].force_kip");
  compare(label, "bottom tie BC (+1013)", ex.member_forces_kips_strength.BC, memA("tie.bottom"), TOL.forces);
  compare(label, "springing strut CF (-1177)", ex.member_forces_kips_strength.CF, memA("arch.2"), TOL.forces);
  compare(label, "springing strut A-side (-1177 by symmetry)", ex.member_forces_kips_strength.CF, memA("arch.0"), TOL.forces);
  compare(label, "crown chord EF (-1013)", ex.member_forces_kips_strength.EF, memA("arch.1"), TOL.forces);
  ["AB", "BD", "AD", "BE", "DE"].forEach(id =>
    skip(label, "member " + id, "two-panel demo members (vertical tie BD region) — not in the funicular topology (fixture topology_note)"));

  // tie capacity — AASHTO phi, from engine As
  compare(label, "tie phiPn (AASHTO 0.9*fy*As)", ex.tie_checks.bottom_tie.phiPn_kips, PHI_T_AASHTO * 60 * mA.AsTie_in2, TOL.tie);
  compare(label, "tie demand", ex.tie_checks.bottom_tie.demand_kips, memA("tie.bottom"), TOL.forces);
  skip(label, "vertical tie BD (600 k / Ast 11.16)", "crack-control vertical tie of the two-panel demo — outside the funicular topology");

  // node C (support CCT) — computed at lb = 12 in the document
  const nodeC = resolvePath(runA, "results.model.nodePolygons[id=node.support.L]");
  const faceC = n => nodeC.faces.find(f => f.name.startsWith(n));
  compare(label, "node C ha", ex.node_checks.node_C_CCT.ha_in, mA.ha_in, TOL.widths);
  compare(label, "node C strut interface width", ex.node_checks.node_C_CCT.strut_interface_width_in, faceC("strut").width_in, TOL.widths);
  compare(label, "node C bearing Acn", ex.node_checks.node_C_CCT.bearing_face.Acn_in2, faceC("bearing").Acn_in2, { rtol: 0.02 });
  compare(label, "node C bearing phiPn (AASHTO 0.70*0.70*fc*Acn)", ex.node_checks.node_C_CCT.bearing_face.phiPn_kips,
    PHI_AASHTO * ex.node_checks.node_C_CCT.bearing_face.nu * fc * faceC("bearing").Acn_in2, TOL.caps);
  compare(label, "node C strut Acn", ex.node_checks.node_C_CCT.strut_interface.Acn_in2, faceC("strut").Acn_in2, { rtol: 0.02 });
  compare(label, "node C strut phiPn (AASHTO 0.70*0.60*fc*Acn)", ex.node_checks.node_C_CCT.strut_interface.phiPn_kips,
    PHI_AASHTO * ex.node_checks.node_C_CCT.strut_interface.nu * fc * faceC("strut").Acn_in2, TOL.caps);
  skip(label, "node C back face", "not checked in the document (AASHTO 5.8.2.5.3b bond exemption); engine reports it under ACI separately");
  skip(label, "node A", "adequate by inspection in the document (same geometry, smaller force)");

  // node F (CCC under the right load) = engine vertex node 2.
  // Engine face names: bearing | strut(arch.1) = FHWA back face | strut(arch.2) = FHWA strut interface.
  const nodeFA = resolvePath(runA, "results.model.nodePolygons[id=node.vertex.2]");
  const nodeFB = resolvePath(runB, "results.model.nodePolygons[id=node.vertex.2]");
  const face = (nd, n) => nd.faces.find(f => f.name.startsWith(n));
  compare(label, "node F ha (= crown depth a)", ex.node_checks.node_F_CCC.ha_in, face(nodeFA, "strut(arch.1)").width_in, TOL.widths);
  compare(label, "node F back-face Acn 288", ex.node_checks.node_F_CCC.back_face.Acn_in2, face(nodeFA, "strut(arch.1)").Acn_in2, { rtol: 0.02 });
  compare(label, "node F back-face phiPn (AASHTO 0.70*0.85*fc*Acn)", ex.node_checks.node_F_CCC.back_face.phiPn_kips,
    PHI_AASHTO * ex.node_checks.node_F_CCC.back_face.nu * fc * face(nodeFA, "strut(arch.1)").Acn_in2, TOL.caps);
  compare(label, "node F strut interface width (initial, lb=12)", ex.node_checks.node_F_CCC.strut_interface_width_initial_in,
    face(nodeFA, "strut(arch.2)").width_in, TOL.widths);
  compare(label, "node F strut interface Acn (initial)", ex.node_checks.node_F_CCC.strut_interface_initial.Acn_in2,
    face(nodeFA, "strut(arch.2)").Acn_in2, { rtol: 0.02 });
  compare(label, "node F strut interface phiPn (initial)", ex.node_checks.node_F_CCC.strut_interface_initial.phiPn_kips,
    PHI_AASHTO * ex.node_checks.node_F_CCC.strut_interface_initial.nu * fc * face(nodeFA, "strut(arch.2)").Acn_in2, TOL.caps);
  compare(label, "node F strut interface width (final, lb=14)", ex.node_checks.node_F_CCC.strut_interface_final.width_in,
    face(nodeFB, "strut(arch.2)").width_in, TOL.widths);
  compare(label, "node F strut interface Acn (final)", ex.node_checks.node_F_CCC.strut_interface_final.Acn_in2,
    face(nodeFB, "strut(arch.2)").Acn_in2, { rtol: 0.02 });
  compare(label, "node F strut interface phiPn (final)", ex.node_checks.node_F_CCC.strut_interface_final.phiPn_kips,
    PHI_AASHTO * 0.60 * fc * face(nodeFB, "strut(arch.2)").Acn_in2, TOL.caps);
  skip(label, "node F bearing Acn 576", "recorded before the plate upsize (12 in) and not re-run in the document; engine models the final 14 in plate (Acn 672)");
  skip(label, "node F back-face steel fix (6 No.8)", "AASHTO reinforced-back-face provision; engine reports the ACI face DCR instead");
  skip(label, "node E resultant check", "statically equivalent to node F in the document (by inspection)");
  skip(label, "smeared nodes B/D", "not checked in the document");

  // anchorage — final stage (lb = 14, e = 5): available embedment from the engine
  compare(label, "anchorage available 25.4", ex.anchorage.ldh_available_in, mB.anchorage.left.available_in, TOL.anch);
  // required side is AASHTO arithmetic (38*db/sqrt(fc_ksi) * lambda_er) — fixture-documented, engine computes ACI ldh instead
  const db10 = 1.27;
  const lhb = 38 * db10 / Math.sqrt(fc);
  compare(label, "ldh basic (AASHTO 38db/sqrt(fc)) — doc arithmetic", ex.anchorage.ldh_basic_lhb_in, lhb, TOL.anch, "fixture-internal consistency");
  compare(label, "ldh required (x lambda_er 0.92) — doc arithmetic", ex.anchorage.ldh_required_in, lhb * ex.anchorage.lambda_er, TOL.anch, "fixture-internal consistency");
  skip(label, "ACI ldh vs AASHTO ldh", "engine ACI 318-19 ldh = " + mB.anchorage.left.required_in.toFixed(2) + " in (psi_r 1.6 unconfined) — different code basis, compared only as documented");
}

// ---------------------------------------------------------------- main
const files = fs.readdirSync(FIXDIR).filter(f => f.endsWith(".json")).sort();
for (const f of files) {
  const full = path.join(FIXDIR, f);
  const fx = JSON.parse(fs.readFileSync(full, "utf8"));
  if (f === "authority_example.json") { runAuthority(fx); continue; }
  if (f === "verified-links.json") continue; // reference-link inventory, not a fixture
  if (!fx.runs && !fx.inputs) { skip(f, "(file)", "no runs/inputs — not a fixture"); continue; }
  runGeneric(full, fx);
}

// ---------------------------------------------------------------- report
const W = { fixture: 38, quantity: 72, expected: 14, actual: 20, tol: 18 };
const cut = (s, n) => { s = String(s); return s.length > n ? s.slice(0, n - 1) + "…" : s.padEnd(n); };
console.log(cut("FIXTURE", W.fixture) + cut("QUANTITY", W.quantity) + cut("EXPECTED", W.expected) + cut("ACTUAL", W.actual) + cut("TOL", W.tol) + "RESULT");
console.log("-".repeat(W.fixture + W.quantity + W.expected + W.actual + W.tol + 6));
let lastFx = "";
for (const r of rows) {
  const fx = r.fixture === lastFx ? "" : r.fixture; lastFx = r.fixture;
  console.log(cut(fx, W.fixture) + cut(r.quantity, W.quantity) + cut(fmtVal(r.expected), W.expected) + cut(fmtVal(r.actual), W.actual) + cut(r.tol, W.tol) + (r.pass === null ? "SKIP" : r.pass ? "PASS" : "FAIL"));
}
const checked = rows.filter(r => r.pass !== null).length;
const skipped = rows.length - checked;
console.log("-".repeat(60));
console.log(checked + " comparisons, " + failures + " failures, " + skipped + " documented skips.");
if (failures > 0) { console.error("FAIL"); process.exit(1); }
console.log("ALL PASS");
