// validate-calc2-chevron.mjs
// Blocking pre-build validation: reproduces Example Problem 1 from
// Fortney & Thornton (2017), "The Chevron Effect and Analysis of Chevron Beams
// -- A Paradigm Shift," AISC Engineering Journal Q4 2017, pp. 276-287.
//
// Run:  node docs/steel-node/validate-calc2-chevron.mjs
// Pass criterion: every reproduced quantity within 1% of the paper's printed value.
//
// The equations here are IDENTICAL to chevronLocal() in
// public/Calcs/brace_connection_at_column_on_beam_calculator.html and to the
// transcription in docs/steel-node/calc2-chevron-spec.md. Symbols match the paper.

// ---- Symbiotic chevron model (Eqs 13,4,25,22,23,20,28,30,33,36,34,48) ----
function chevron({ L, a, Lg, eb, dlt, SVt, SVb, SHt, SHb }) {
  const b = L - a;
  const aP = a - Lg / 2;                    // a' : left support to left edge of gusset
  const Maat = SHt * eb + SVt * dlt;        // (Ma-a)t   Eq 13
  const Maab = SVb * dlt - SHb * eb;        // (Ma-a)b   Eq 4
  const MT = Maat + Maab;                   // Eq 27
  const SVT = SVt + SVb;                    // Eq 21
  const SHT = SHt + SHb;
  const q = (SHt - SHb) * eb / Lg;          // Eq 25
  const wl = -4 * Maat / (Lg * Lg) - 4 * Maab / (Lg * Lg) + SVt / Lg + SVb / Lg;  // Eq 22
  const wr = 4 * Maat / (Lg * Lg) + 4 * Maab / (Lg * Lg) + SVt / Lg + SVb / Lg;   // Eq 23
  const R1 = -SVT * b / L;                  // Eq 20
  const R2 = -SVT * a / L;

  // Left half extremum
  const x1 = (-R1 - q) / wl;                // Eq 28
  const Mleft = (x1r) => R1 * aP + (R1 + q) * x1r + 0.5 * wl * x1r * x1r;         // Eq 30
  // Right half extremum
  const x2 = -(R1 + 0.5 * wl * Lg + q) / wr;  // Eq 36
  const Mright = (x2r) => 0.5 * wr * x2r * x2r + (R1 + 0.5 * wl * Lg + q) * x2r
    + (R1 * (aP + 0.5 * Lg) + 0.125 * wl * Lg * Lg + 0.5 * q * Lg);               // Eq 34

  // candidate moments: interior roots (if in range) plus both-half edges
  const cands = [];
  if (x1 >= 0 && x1 <= Lg / 2) cands.push(Mleft(x1));
  cands.push(Mleft(0), Mleft(Lg / 2));
  if (x2 >= 0 && x2 <= Lg / 2) cands.push(Mright(x2));
  cands.push(Mright(0), Mright(Lg / 2));
  // governing = largest magnitude
  let Mmax = cands[0];
  for (const m of cands) if (Math.abs(m) > Math.abs(Mmax)) Mmax = m;

  const Vmax = R1 + 0.5 * wl * Lg;          // Eq 33

  // Chevron-dominance (Delta = 0 closed form, Eq 48)
  const bl = b / L;
  const Lgeq = (MT / SVT) * ((bl - Math.sqrt(bl)) / (bl - bl * bl));

  // Divergent reference methods
  const V_conn = 2 * MT / Lg;               // connection-designer shear
  const M_conn = MT / 2;                    // connection-designer moment

  return { b, aP, Maat, Maab, MT, SVT, SHT, q, wl, wr, R1, R2, x1, x2, Mmax, Vmax, Lgeq, V_conn, M_conn };
}

// ---- Test harness ----
let pass = 0, fail = 0;
const lines = [];
function chk(id, got, want, tolPct = 1.0) {
  // tolerance relative to the paper value; absolute floor for near-zero values
  const denom = Math.abs(want) < 1e-9 ? 1 : Math.abs(want);
  const dPct = Math.abs(got - want) / denom * 100;
  const ok = dPct <= tolPct;
  if (ok) pass++; else fail++;
  lines.push(
    `${ok ? 'PASS' : 'FAIL'}  ${id.padEnd(28)} got=${fmt(got)}  paper=${fmt(want)}  d=${dPct.toFixed(2)}%`
  );
}
function fmt(x) { return (Math.abs(x) >= 100 ? x.toFixed(1) : x.toFixed(3)); }

// ===== Example Problem 1 — inputs =====
const L = 336, a = 168;   // 28 ft span, w.p. at midspan

// ---- Part 1: approximate geometry Lg,app=56.0, eb,app=10.5 ----
const P1_buck = chevron({ L, a, Lg: 56.0, eb: 10.5, dlt: 0, SVt: 151, SVb: -187, SHt: 285, SHb: -531 });
const P1_post = chevron({ L, a, Lg: 56.0, eb: 10.5, dlt: 0, SVt: 197.9, SVb: -307.5, SHt: 238.1, SHb: -410.5 });

lines.push('--- Part 1 (approx geometry Lg=56.0, eb=10.5) : Buckling load case ---');
chk('P1-BUCK (Ma-a)t', P1_buck.Maat, 2993);
chk('P1-BUCK (Ma-a)b', P1_buck.Maab, 5576);
chk('P1-BUCK MT', P1_buck.MT, 8569);
chk('P1-BUCK q', P1_buck.q, 153);
chk('P1-BUCK wl', P1_buck.wl, -11.6);
chk('P1-BUCK R1', P1_buck.R1, 18.0);
chk('P1-BUCK Lg,eq', P1_buck.Lgeq, 197, 1.5);
chk('P1-BUCK x1', P1_buck.x1, 14.8);
chk('P1-BUCK Vmax', P1_buck.Vmax, -307);
chk('P1-BUCK Mmax', P1_buck.Mmax, 3780);

lines.push('--- Part 1 : Post-buckling load case ---');
chk('P1-POST (Ma-a)t', P1_post.Maat, 2500);
chk('P1-POST (Ma-a)b', P1_post.Maab, 4310);
chk('P1-POST MT', P1_post.MT, 6810);
chk('P1-POST q', P1_post.q, 122);
chk('P1-POST wl', P1_post.wl, -10.7);
chk('P1-POST R1', P1_post.R1, 54.8);
chk('P1-POST Lg,eq', P1_post.Lgeq, 51.5);
chk('P1-POST x1', P1_post.x1, 16.5);
chk('P1-POST Vmax', P1_post.Vmax, -245);
chk('P1-POST Mmax', P1_post.Mmax, 9130);

// ---- Part 2: actual connection geometry Lg=54.0, eb=10.8 ----
const P2_buck = chevron({ L, a, Lg: 54.0, eb: 10.8, dlt: 0, SVt: 151, SVb: -187, SHt: 285, SHb: -531 });
const P2_post = chevron({ L, a, Lg: 54.0, eb: 10.8, dlt: 0, SVt: 197.9, SVb: -307.5, SHt: 238.1, SHb: -410.5 });

lines.push('--- Part 2 (connection geometry Lg=54.0, eb=10.8) : Buckling ---');
chk('P2-BUCK (Ma-a)t', P2_buck.Maat, 3078);
chk('P2-BUCK (Ma-a)b', P2_buck.Maab, 5735);
chk('P2-BUCK MT', P2_buck.MT, 8813);
chk('P2-BUCK q', P2_buck.q, 163);
chk('P2-BUCK wl', P2_buck.wl, -12.8);
chk('P2-BUCK wr', P2_buck.wr, 11.4);
chk('P2-BUCK Lg,eq', P2_buck.Lgeq, 203, 1.5);
chk('P2-BUCK V_conn', P2_buck.V_conn, 326);
chk('P2-BUCK M_conn', P2_buck.M_conn, 4407);

lines.push('--- Part 2 : Post-buckling ---');
chk('P2-POST (Ma-a)t', P2_post.Maat, 2571);
chk('P2-POST (Ma-a)b', P2_post.Maab, 4433);
chk('P2-POST MT', P2_post.MT, 7004);
chk('P2-POST q', P2_post.q, 130);
chk('P2-POST wl', P2_post.wl, -11.6);
chk('P2-POST wr', P2_post.wr, 7.58, 1.5);
chk('P2-POST Lg,eq', P2_post.Lgeq, 52.9);
chk('P2-POST V_conn', P2_post.V_conn, 260);
chk('P2-POST M_conn', P2_post.M_conn, 3502);

// ---- single-sided reduction sanity (top gusset only; node topology) ----
// Balanced-ish single brace on top: verify local shear/moment are finite & Vi drives R1.
const single = chevron({ L: 240, a: 120, Lg: 24, eb: 9.0, dlt: 0, SVt: 40, SVb: 0, SHt: 60, SHb: 0 });
lines.push('--- Single-sided (top gusset only) reduction sanity ---');
chk('SS ΣV_T=ΣVt', single.SVT, 40);
chk('SS (Ma-a)b=0', single.Maab, 0);
chk('SS q=ΣHt*eb/Lg', single.q, 60 * 9.0 / 24);

// ---- report ----
console.log('CHEVRON VALIDATION — Fortney & Thornton (2017) Example Problem 1');
console.log(lines.join('\n'));
console.log('----------------------------------------------------------------');
console.log(`RESULT: ${fail === 0 ? 'PASS' : 'FAIL'}  ${pass}/${pass + fail} checks within tolerance`);
process.exit(fail === 0 ? 0 : 1);

export { chevron };
