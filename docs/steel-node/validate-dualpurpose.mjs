// validate-dualpurpose.mjs
// Independent validation of the dual-purpose stiffener/gusset combined-stress model
// (build spec sect. 8.1). Confirms:
//   (1) the plane-stress von Mises value matches a closed-form hand solution,
//   (2) the combined check degenerates EXACTLY to the single-role checks at the limits,
//   (3) principal stresses from the same state agree (cross-check of the invariant).
//
// Run:  node docs/steel-node/validate-dualpurpose.mjs
// This mirrors dualPurposeVM() in the calculator HTML.

// von Mises equivalent stress for plane stress (sx, sy normal; txy shear)
function vonMises(sx, sy, txy) {
  return Math.sqrt(sx * sx - sx * sy + sy * sy + 3 * txy * txy);
}
// principal stresses (plane stress) -> von Mises rebuilt from principals as a cross-check
function principals(sx, sy, txy) {
  const avg = (sx + sy) / 2;
  const R = Math.sqrt(((sx - sy) / 2) ** 2 + txy * txy);
  return [avg + R, avg - R];
}
function vmFromPrincipals(s1, s2) {
  return Math.sqrt(s1 * s1 - s1 * s2 + s2 * s2); // s3 = 0 (plane stress)
}

let pass = 0, fail = 0;
const out = [];
function chk(id, got, want, tol = 1e-4) {
  const d = Math.abs(got - want);
  const rel = Math.abs(want) < 1e-9 ? d : d / Math.abs(want);
  const ok = rel <= tol;
  ok ? pass++ : fail++;
  out.push(`${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(34)} got=${got.toFixed(4)} want=${want.toFixed(4)} rel=${(rel * 100).toFixed(4)}%`);
}

// ---- (1) Known biaxial state (Boresi & Schmidt, Adv. Mech. Materials, plane stress) ----
// sx=+20, sy=-10 ksi, txy=15 ksi. Hand: svm=sqrt(400 -(20*-10) +100 +3*225)
//  = sqrt(400 +200 +100 +675) = sqrt(1375) = 37.0810 ksi
chk('VM biaxial state', vonMises(20, -10, 15), Math.sqrt(1375));

// principals of same state: avg=5, R=sqrt(15^2+15^2)=21.2132 -> s1=26.2132, s2=-16.2132
const [s1, s2] = principals(20, -10, 15);
chk('principal s1', s1, 5 + Math.sqrt(450));
chk('principal s2', s2, 5 - Math.sqrt(450));
// VM rebuilt from principals must equal the direct invariant
chk('VM(principals)==VM(direct)', vmFromPrincipals(s1, s2), vonMises(20, -10, 15));

// ---- (2) Degenerate limit: pure gusset (bearing=0, no shear) -> |sx| ----
chk('degenerate pure gusset', vonMises(28, 0, 0), 28);          // -> sqrt(sx^2) = sx
// Degenerate limit: pure bearing (gusset=0, no shear) -> |sy| = J7 bearing stress
chk('degenerate pure bearing', vonMises(0, 33, 0), 33);
// Degenerate: pure shear -> sqrt(3)*txy (von Mises shear yield)
chk('degenerate pure shear', vonMises(0, 0, 12), Math.sqrt(3) * 12);

// ---- (3) Worse-of same-sign vs opposite-sign assembly (build spec 8.1) ----
// Same-sign normals reduce VM via the -sx*sy term; opposite-sign increases it.
// The calc must take the LARGER (opposite-sign) as governing.
const sg = 20, sb = 14, tau = 8;
const sameSign = vonMises(sg, sb, tau);        // both +
const oppSign = vonMises(sg, -sb, tau);        // opposite
const governing = Math.max(sameSign, oppSign);
chk('governing = opposite-sign (worse)', governing, oppSign);
out.push(`       same-sign VM = ${sameSign.toFixed(4)} ksi ; opposite-sign VM = ${oppSign.toFixed(4)} ksi (governs)`);

// ---- (4) Design check example: A36 plate, phi=0.90 ----
// tg=0.5", Lg=12", H=60 kip transverse bearing over 8" eff, gusset sH=45 kip, Ma-a=120 k-in, V=30 kip
const tg = 0.5, Lg = 12, AeffB = 0.5 * 8;
const sGus = 45 / (tg * Lg) + 6 * 120 / (tg * Lg * Lg);   // axial + flexure
const tauG = 30 / (tg * Lg);
const sBear = 60 / AeffB;
const svm = Math.max(vonMises(sGus, sBear, tauG), vonMises(sGus, -sBear, tauG));
const phiFy = 0.90 * 36;
out.push(`       design example: sGus=${sGus.toFixed(2)} sBear=${sBear.toFixed(2)} tau=${tauG.toFixed(2)} -> svm=${svm.toFixed(2)} ksi, phiFy=${phiFy.toFixed(1)} ksi, D/C=${(svm / phiFy).toFixed(3)}`);
chk('design example D/C finite & >0', (svm / phiFy) > 0 && isFinite(svm / phiFy) ? 1 : 0, 1);

console.log('DUAL-PURPOSE COMBINED-STRESS VALIDATION (build spec sect. 8.1)');
console.log(out.join('\n'));
console.log('----------------------------------------------------------------');
console.log(`RESULT: ${fail === 0 ? 'PASS' : 'FAIL'}  ${pass}/${pass + fail} checks`);
process.exit(fail === 0 ? 0 : 1);

export { vonMises };
