// =============================================================================
// Wood Connection Schedule — engine fixture test (pure Node, no browser)
// -----------------------------------------------------------------------------
// Loads public/Calcs/engines/wood-connections.js with require() (the engine is
// DOM-free and exports module.exports), runs WC.runFixtures() — the NDS 2018
// table reproductions (12A/B/F/G, 12J/K, 12L/M, 12N/P, 12.2A–C, 12.2F,
// 11.3.6A/C) plus the branch matrix of spec §8 — prints one line per
// assertion and exits 1 on any failure.
// Usage: node tools/test-wood-connections.mjs   (npm run test:wc)
// =============================================================================
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ENGINE = fileURLToPath(new URL('../public/Calcs/engines/wood-connections.js', import.meta.url));
const WC = require(ENGINE);

if (!WC || typeof WC.compute !== 'function' || typeof WC.runFixtures !== 'function') {
  console.error('engine did not export compute/runFixtures');
  process.exit(1);
}
console.log(`engine ${WC.ENGINE.name} v${WC.ENGINE.version} (${WC.ENGINE.rev}) — ${WC.ENGINE.codes.join(', ')}`);

const fmt = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? String(v) : v.toPrecision(6)) : typeof v === 'object' ? JSON.stringify(v) : String(v));
const fx = WC.runFixtures();
for (const r of fx.results) {
  const where = [r.table, r.cell].filter(Boolean).join(' · ');
  const line = `${r.ok ? 'PASS' : 'FAIL'} ${r.name}${where ? '  [' + where + ']' : ''}  expected=${fmt(r.expected)} got=${fmt(r.got)}${r.tol !== null && r.tol !== undefined ? ' tol=' + fmt(r.tol) : ''}`;
  console.log(line);
  if (!r.ok && r.inputs) console.log('      inputs: ' + JSON.stringify(r.inputs));
}

// Smoke: the exported surface the page depends on.
const surface = ['compute', 'runFixtures', 'newRow', 'defaultState', 'DATA', 'ENGINE', '_combined'];
const missing = surface.filter((k) => !(k in WC));
if (missing.length) { console.error('missing exports: ' + missing.join(', ')); process.exit(1); }
const st = WC.defaultState();
st.bolts.push(WC.newRow('bolt', { id: ++st.rowCnt }));
const out = WC.compute(st);
console.log(`smoke: default bolt row status=${out.tables.bolts[0].status} (blank V → incomplete expected)`);
if (out.tables.bolts[0].status !== 'incomplete') { console.error('smoke failed'); process.exit(1); }

console.log(`\nfixtures: ${fx.pass} pass / ${fx.fail} fail / ${fx.total} total`);
if (fx.fail > 0) { console.error(`${fx.fail} failure(s)`); process.exit(1); }
console.log('ALL PASS');
