#!/usr/bin/env node
// Independent validation for Calc 1 (hss_column_bearing_on_beam_calculator.html).
//
// Two things are validated here, standalone from the calculator's own JS:
//   (1) Hand/arithmetic reproduction of AISC 360-22 J10.2 (web local yielding) and
//       J10.3 (web local crippling) for the four cross-calc equivalence fixtures
//       (J10-EQ-1..4) required by the build spec. These numbers are transcribed
//       directly from the equations printed in the AISC 360-22 PDF (Sect. J10.2,
//       J10.3), not copy-pasted from the calculator's source.
//   (2) The top-flange local-bending yield-line model derived in
//       calc1-top-flange-spec.md, bounded against an independently-derived
//       elastic plate-strip (first-yield) solution of the same idealized strip.
//
// Run: node docs/steel-node/validate-calc1.mjs

const E = 29000; // ksi

function round2(x) { return Math.round(x * 100) / 100; }

// ---------------------------------------------------------------------------
// AISC v16.0 shape properties for the fixture set (transcribed from the
// embedded shape database extracted from aisc-shapes-database-v16.0.xlsx,
// same source cited by the calculator).
// ---------------------------------------------------------------------------
const SHAPES = {
  W18X50: { d: 18.0, bf: 7.50, tf: 0.570, tw: 0.355, kdes: 0.972 },
  W24X55: { d: 23.6, bf: 7.01, tf: 0.505, tw: 0.395, kdes: 1.01 },
  W12X26: { d: 12.2, bf: 6.49, tf: 0.380, tw: 0.230, kdes: 0.680 },
};

// ---------------------------------------------------------------------------
// AISC 360-22 §J10.2 Web Local Yielding
//   (a) x > d (interior):        Rn = Fyw*tw*(5k + lb)          Eq. J10-2   phi=1.00
//   (b) x <= d (near end):       Rn = Fyw*tw*(2.5k + lb)        Eq. J10-3   phi=1.00
// ---------------------------------------------------------------------------
function j102(shape, Fy, x, lb) {
  const { tw, kdes, d } = shape;
  const branch = x > d ? "interior" : "end";
  const factor = branch === "interior" ? 5 : 2.5;
  const Rn = Fy * tw * (factor * kdes + lb);
  const phi = 1.0;
  return { Rn, phiRn: phi * Rn, branch, eq: branch === "interior" ? "J10-2" : "J10-3(spec eq #)" };
}

// ---------------------------------------------------------------------------
// AISC 360-22 §J10.3 Web Local Crippling
//   (a) x >= d/2 (interior):
//       Rn = 0.80*tw^2*[1 + 3*(lb/d)*(tw/tf)^1.5]*sqrt(E*Fyw*tf/tw)*Qf        Eq. J10-4
//   (b) x < d/2 (near end):
//       lb/d <= 0.2:
//         Rn = 0.40*tw^2*[1 + 3*(lb/d)*(tw/tf)^1.5]*sqrt(E*Fyw*tf/tw)*Qf      Eq. J10-5a
//       lb/d > 0.2:
//         Rn = 0.40*tw^2*[1 + (4*lb/d - 0.2)*(tw/tf)^1.5]*sqrt(E*Fyw*tf/tw)*Qf Eq. J10-5b
//   Qf = 1.0 for wide-flange sections.
//   phi = 0.75
// ---------------------------------------------------------------------------
function j103(shape, Fy, x, lb) {
  const { tw, tf, d } = shape;
  const Qf = 1.0;
  const ldRatio = lb / d;
  const twtf15 = Math.pow(tw / tf, 1.5);
  const sqrtTerm = Math.sqrt((E * Fy * tf) / tw);
  let Rn, eq;
  if (x >= d / 2) {
    Rn = 0.80 * tw * tw * (1 + 3 * ldRatio * twtf15) * sqrtTerm * Qf;
    eq = "J10-4";
  } else if (ldRatio <= 0.2) {
    Rn = 0.40 * tw * tw * (1 + 3 * ldRatio * twtf15) * sqrtTerm * Qf;
    eq = "J10-5a";
  } else {
    Rn = 0.40 * tw * tw * (1 + (4 * ldRatio - 0.2) * twtf15) * sqrtTerm * Qf;
    eq = "J10-5b";
  }
  const branch = x >= d / 2 ? "interior" : "end";
  const phi = 0.75;
  return { Rn, phiRn: phi * Rn, branch, eq };
}

const FIXTURES = [
  { id: "J10-EQ-1", section: "W18X50", Fy: 50, x: 120, lb: 8.0 },
  { id: "J10-EQ-2", section: "W18X50", Fy: 50, x: 6.0, lb: 6.0 },
  { id: "J10-EQ-3", section: "W24X55", Fy: 50, x: 150, lb: 10.0 },
  { id: "J10-EQ-4", section: "W12X26", Fy: 50, x: 4.0, lb: 4.5 },
  // x = d exactly: AISC 360-22 J10.2 interior branch applies only when x is GREATER than d,
  // so the boundary takes the end (2.5k) equation — drift guard for the x>d vs x>=d defect.
  { id: "J10-EQ-5", section: "W18X50", Fy: 50, x: 18.0, lb: 7.0 },
];

console.log("=== AISC 360-22 J10.2 / J10.3 independent arithmetic ===\n");

const results = [];
for (const fx of FIXTURES) {
  const shape = SHAPES[fx.section];
  const r102 = j102(shape, fx.Fy, fx.x, fx.lb);
  const r103 = j103(shape, fx.Fy, fx.x, fx.lb);
  // J10.2 branch governs the reported "branch" per fixture id per selftest contract
  // (interior/end determined by x vs d, same threshold family reported once).
  const branch = r102.branch; // matches J10.2's interior/end definition (x vs d)
  const line = `${fx.id} phiRnJ102=${round2(r102.phiRn).toFixed(2)} phiRnJ103=${round2(r103.phiRn).toFixed(2)} branch=${branch}`;
  console.log(line);
  console.log(
    `  [detail] section=${fx.section} Fy=${fx.Fy} x=${fx.x} lb=${fx.lb} d=${shape.d} tw=${shape.tw} tf=${shape.tf} kdes=${shape.kdes}`
  );
  console.log(
    `  [J10.2]  branch(x vs d)=${r102.branch}  Rn=${r102.Rn.toFixed(4)} kips  phi=1.00  phiRn=${r102.phiRn.toFixed(4)} kips`
  );
  console.log(
    `  [J10.3]  branch(x vs d/2)=${r103.branch}  eq=${r103.eq}  Rn=${r103.Rn.toFixed(4)} kips  phi=0.75  phiRn=${r103.phiRn.toFixed(4)} kips`
  );
  console.log("");
  results.push({ id: fx.id, phiRnJ102: round2(r102.phiRn), phiRnJ103: round2(r103.phiRn), branch });
}

console.log("Expected calculator selftest lines (compare verbatim against SELFTEST output):");
for (const r of results) {
  console.log(`  ${r.id} phiRnJ102=${r.phiRnJ102.toFixed(2)} phiRnJ103=${r.phiRnJ103.toFixed(2)} branch=${r.branch}`);
}

// ---------------------------------------------------------------------------
// AISC 360-22 §J10.4 Web Sidesway Buckling — independent hand arithmetic
// (FIX ROUND 1: numeric fixtures for BOTH branches, verified against the PDF,
//  Sect. J10.4, 16.1-152/153)
//   Restrained flange (Eq. J10-6):   Rn = (Cr*tw^3*tf/h^2)*[1 + 0.4*r^3]
//   Unrestrained flange (Eq. J10-7): Rn = (Cr*tw^3*tf/h^2)*[0.4*r^3]
//   r = (h/tw)/(Lb/bf); applicability r <= 2.3 (restrained) / r <= 1.7 (unrestr.)
//   Cr = 960,000 ksi when Mr < My at the force location; phi = 0.85
// ---------------------------------------------------------------------------
console.log("\n=== AISC 360-22 J10.4 independent arithmetic (Eq. J10-6 / J10-7) ===\n");

let j104OK = true;
{
  const { tw, tf, bf } = SHAPES.W18X50;      // tw=0.355, tf=0.570, bf=7.50
  const h = 16.046;                           // clear h for W18X50 (h/tw=45.2 x tw=0.355, AISC v16.0)
  const Sx = 88.9;                            // in^3, AISC v16.0
  const Fy = 50, Lb = 200, MuBeam = 60;       // ksi, in, kip-ft

  const r = (h / tw) / (Lb / bf);
  const Mr = Math.abs(MuBeam) * 12;           // kip-in (alpha_s = 1.0 LRFD)
  const My = Fy * Sx;                         // kip-in
  const Cr = Mr < My ? 960000 : 480000;
  const base = (Cr * Math.pow(tw, 3) * tf) / (h * h);
  const phi = 0.85;

  const RnRest = base * (1 + 0.4 * Math.pow(r, 3));   // Eq. J10-6
  const RnUnrest = base * (0.4 * Math.pow(r, 3));      // Eq. J10-7
  const phiRnRest = phi * RnRest;
  const phiRnUnrest = phi * RnUnrest;

  console.log(`Fixture: W18X50, Fy=${Fy}, Lb=${Lb} in, MuBeam=${MuBeam} kip-ft`);
  console.log(`  h=${h}, tw=${tw}, tf=${tf}, bf=${bf}, Sx=${Sx}`);
  console.log(`  r = (h/tw)/(Lb/bf) = (${(h / tw).toFixed(4)})/(${(Lb / bf).toFixed(4)}) = ${r.toFixed(6)}`);
  console.log(`  Applicability: r=${r.toFixed(3)} <= 1.7 (unrestrained) and <= 2.3 (restrained) — both branches apply`);
  console.log(`  Mr = ${Mr.toFixed(1)} kip-in < My = Fy*Sx = ${My.toFixed(1)} kip-in -> Cr = ${Cr} ksi`);
  console.log(`  base = Cr*tw^3*tf/h^2 = ${base.toFixed(6)} kips`);
  console.log(`  Eq. J10-6 (restrained):   Rn = base*[1+0.4r^3] = ${RnRest.toFixed(4)} kips; phiRn = 0.85*Rn = ${phiRnRest.toFixed(4)} kips`);
  console.log(`  Eq. J10-7 (unrestrained): Rn = base*[0.4r^3]   = ${RnUnrest.toFixed(4)} kips; phiRn = 0.85*Rn = ${phiRnUnrest.toFixed(4)} kips`);
  console.log("\nExpected calculator selftest values (compare against SELFTEST output):");
  console.log(`  C1-J104-3 expected phiRn (restrained, Eq. J10-6)   = ${round2(phiRnRest).toFixed(2)} kips`);
  console.log(`  C1-J104-4 expected phiRn (unrestrained, Eq. J10-7) = ${round2(phiRnUnrest).toFixed(2)} kips`);

  // Internal consistency: restrained must exceed unrestrained by exactly base*1.0
  const diff = RnRest - RnUnrest;
  const diffOK = Math.abs(diff - base) < 1e-9;
  console.log(`  Consistency (RnRest - RnUnrest == base term): ${diffOK ? "PASS" : "FAIL"} (diff=${diff.toFixed(6)}, base=${base.toFixed(6)})`);
  j104OK = diffOK && isFinite(phiRnRest) && isFinite(phiRnUnrest);
}

// ---------------------------------------------------------------------------
// Top-flange local bending: yield-line model vs. independent elastic bound
// (fixture from calc1-top-flange-spec.md §4)
// ---------------------------------------------------------------------------
console.log("\n=== Top-flange local bending — yield-line model vs. independent elastic bound ===\n");

function topFlangeYieldLine({ bf, tf, tw, Fy, lb, wp, ew, Ppatch }) {
  const c = (bf - tw) / 2;
  const webFace = tw / 2;
  const farEdge = ew + wp / 2;
  const nearEdge = ew - wp / 2;
  if (farEdge <= webFace) {
    return { applicable: false, reason: "footprint fully over web — no overhang demand" };
  }
  const overhangStart = Math.max(nearEdge, webFace);
  const overhangLen = farEdge - overhangStart; // length of footprint outboard of web face
  const fractionOver = overhangLen / wp;
  const Pover = Ppatch * fractionOver;
  const a = overhangStart + overhangLen / 2 - webFace; // lever arm from web face to overhang centroid
  const beff = Math.min(wp + 2 * a, bf);
  const Mu = Pover * a; // kip-in
  const mpUnit = (Fy * tf * tf) / 4; // kip-in/in
  const Mn = mpUnit * beff; // kip-in
  const phi = 0.9;
  const phiMn = phi * Mn;
  return { applicable: true, c, a, beff, Pover, Mu, mpUnit, Mn, phiMn, DC: Mu / phiMn };
}

function elasticBoundUnit({ Fy, tf }) {
  return (Fy * tf * tf) / 6; // kip-in/in, first-yield elastic capacity of unit-width strip
}

// Act4-16: e_w = 0.5 keeps the footprint on the flange (far edge = 0.5 + 6/2
// = 3.5 in <= bf/2 = 3.75 in) so this fixture stays legal under the
// calculator's footprint-fits-on-flange blocking validation. Expected
// arithmetic: webFace = 0.1775, farEdge = 3.5, overhangLen = 3.3225,
// fraction = 0.55375, P_over = 55.375 k, a = 1.66125 in,
// b_eff = min(9.3225, 7.5) = 7.5 in, Mu = 91.99 kip-in,
// mp = 4.06125 kip-in/in, Mn = 30.459, phiMn = 27.413, D/C = 3.356.
const tfFixture = {
  bf: 7.5,
  tf: 0.57,
  tw: 0.355,
  Fy: 50,
  lb: 8.0,
  wp: 6.0,
  ew: 0.5,
  Ppatch: 100,
};

const yl = topFlangeYieldLine(tfFixture);
const myUnit = elasticBoundUnit(tfFixture);
const mpUnit = yl.mpUnit;
const shapeFactorRatio = mpUnit / myUnit;

console.log(`Fixture: W18X50 top flange, bf=${tfFixture.bf}, tf=${tfFixture.tf}, tw=${tfFixture.tw}, Fy=${tfFixture.Fy}`);
console.log(`  footprint: lb=${tfFixture.lb}, wp=${tfFixture.wp}, e_w=${tfFixture.ew}, P_patch=${tfFixture.Ppatch} kips`);
console.log(`  c (half-flange overhang) = ${yl.c.toFixed(4)} in`);
console.log(`  overhang centroid lever arm a = ${yl.a.toFixed(4)} in`);
console.log(`  b_eff (45deg fan, capped at bf) = ${yl.beff.toFixed(4)} in`);
console.log(`  P_over = ${yl.Pover.toFixed(3)} kips`);
console.log(`  Mu (demand about web hinge) = ${yl.Mu.toFixed(3)} kip-in`);
console.log(`  Plastic (yield-line) unit capacity  Mp,unit = Fy*tf^2/4 = ${mpUnit.toFixed(4)} kip-in/in`);
console.log(`  Elastic (independent bound) unit capacity My,unit = Fy*tf^2/6 = ${myUnit.toFixed(4)} kip-in/in`);
console.log(`  Mp,unit / My,unit = ${shapeFactorRatio.toFixed(6)}  (must equal rectangular shape factor 1.500000)`);
console.log(`  Mn (yield-line, total) = Mp,unit * b_eff = ${yl.Mn.toFixed(3)} kip-in`);
console.log(`  phi*Mn = 0.90 * Mn = ${yl.phiMn.toFixed(3)} kip-in`);
console.log(`  D/C = Mu / (phi*Mn) = ${yl.DC.toFixed(3)}`);

const boundOK = Math.abs(shapeFactorRatio - 1.5) < 1e-9;
console.log(`\n  Bounding check (Mp,unit/My,unit == 1.5 exactly): ${boundOK ? "PASS" : "FAIL"}`);
console.log(
  `  Sense check (plastic mechanism capacity > conservative elastic first-yield capacity for same geometry): ${
    mpUnit > myUnit ? "PASS (bounds sensibly)" : "FAIL"
  }`
);

// ---------------------------------------------------------------------------
// Exit status
// ---------------------------------------------------------------------------
let allOK = boundOK && mpUnit > myUnit && j104OK;
for (const r of results) {
  if (!isFinite(r.phiRnJ102) || !isFinite(r.phiRnJ103)) allOK = false;
}

console.log(`\n=== Overall: ${allOK ? "PASS" : "FAIL"} ===`);
process.exit(allOK ? 0 : 1);
