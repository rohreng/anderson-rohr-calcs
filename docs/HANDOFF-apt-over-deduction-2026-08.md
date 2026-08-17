# HANDOFF — A_pt over-deduction inversion, masonry TOW anchor designer

Date: 2026-08-05
Status: diagnosed and numerically confirmed. **No code changed yet.**
Author of diagnosis: prior Claude Code session (Nick reported the symptom).

---

## 1. Symptom as reported

`public/Calcs/masonry_anchor_calculator.html`, discrete-group mode.

Same connection, same loads (T = 11.9 kip, V = 9.4 kip). Only the `L_b` entry mode changed:

| Run | L_b entry | L_b used | Result |
|---|---|---|---|
| A | "Enter effective L_b directly" | 5.00″ | **PASS**, max D/C = 0.600 |
| B | "Enter total embedment", emb = 7″, t_head = 0.34375″ | 6.656″ | **FAIL**, max D/C = 7.826 |

Increasing embedment by 33% dropped capacity by a factor of ~5.6. That direction is non-physical
and is the bug.

Shared inputs for both runs (this is the reproduction case):

```
b (wall)      = 11.625 in  (12" CMU)
f'm           = 2.5 ksi
phi (bolt)    = 0.75 in   (3/4"-10 UNC, A307)
t_head        = 0.34375 in
rows          = 2 (staggered across thickness)
o1            = 3.5 in    (row 1 offset from near face)
g             = 5.0 in    (gauge between rows)
cols          = 3
s             = 8.0 in    (column spacing)
N             = 6
shear dir     = in-plane, wall end remote (le,end box checked)
T_service     = 11.9 kip   V_service = 9.4 kip
1/3 stress increase: ON  (k = 3/4 on demand side)
rigid-attachment confirmation: checked
```

---

## 2. Root cause

`computeDiscreteGeometry()` — [`public/Calcs/masonry_anchor_calculator.html:885`](../public/Calcs/masonry_anchor_calculator.html)

```js
a.Apt = Math.PI*Lb*Lb - segNear - segFar - lensTotal;
// lensTotal = Σ circSeg(Lb, c/2) over EVERY other anchor with c < 2*Lb
```

and the shear analogue at line 898:

```js
a.Apv = Math.PI*lbe_i*lbe_i/2.0 - avTotal;
// avTotal = Σ 0.5*circSeg(lbe_i, c/2) over same-row anchors with c < 2*lbe_i
```

This is **first-order inclusion–exclusion, truncated**. It is essentially exact while the pairwise
overlap lenses are mutually disjoint. It fails as soon as three or more cones share the same
region: that shared region is subtracted two, three, or four times.

**Threshold for this geometry.** Triple overlap of anchors R1C1 / R1C2 / R2C2 begins when `L_b`
exceeds the circumradius of the triangle they form. Sides are 8, 5, 9.434 (a right triangle, since
8² + 5² = 9.434²), so the circumradius is 9.434 / 2 = **4.717″**.

- Run A (L_b = 5.00) is 0.28″ past the threshold — error ~2%, invisible.
- Run B (L_b = 6.656) is 1.94″ past — error ~43%, catastrophic.

**Why the whole check block fails at once.** Both governing capacities are linear in `A_pt`:

- `B_a,mas = 1.25·A_pt·√f'm` (§8.1.4.3.1)
- `B_v3 = B_vpry = 2.5·A_pt·√f'm` (Eq. 8-6)

so tension breakout and shear pryout collapse together. `A_pv` is unaffected here (it uses
`lbe = near-face distance = 3.5″`, and 2·lbe = 7 < s = 8, so no same-row overlap) — the reported
`A_pv = 19.242 in²` is identical in both runs. Confirms a single root cause.

---

## 3. Numerical confirmation

Reproduced independently in Node (script in §6). Values match the deployed calculator.

| | L_b = 5.00 | L_b = 6.656 |
|---|---|---|
| A_pt, R1C1 | 51.081 | 44.530 |
| A_pt, R1C2 | 46.364 | 12.231 |
| A_pt, R2C1 | 48.274 | 40.201 |
| A_pt, **R2C2 (governs)** | **43.557** | **7.902** |
| Σ A_pt,i (all 6) | 288.63 | 189.59 |
| **True union area of the 6 cones** | **294.36** | **335.33** |
| B_a = 1.25·A_pt,gov·√f'm | 2.722 k | 0.494 k |
| B_v3 pryout | 3.119 k | 0.988 k |

The physical breakout surface **grows** 294 → 335 in². The model's governing per-anchor area
**collapses** 43.6 → 7.9 in². At L_b = 6.656 the model discards 44% of the real area
(189.6 vs 335.3).

Screenshot values from Nick's run B were 44.491 / 12.107 / 7.90-ish — the field displayed the
rounded `6.66`, hence the third-decimal difference from `6.65625`. Same phenomenon.

---

## 4. Proposed fix — Voronoi tributary partition

Replace the pairwise lens subtraction with: **each anchor gets the area of its own cone that is
closer to it than to any other anchor**, clipped by the wall faces.

Properties this buys:

- `Σ A_pt,i` equals the true union area exactly (no double-counting, no gaps).
- `A_pt,i` is monotonically non-decreasing in `L_b`. The inversion cannot recur.
- Degenerates to the current pairwise result in the low-overlap regime, where pairwise is already
  correct.

Verified on the reproduction case:

| governing A_pt | L_b = 5.00 | L_b = 6.656 |
|---|---|---|
| current pairwise | 43.56 in² | 7.90 in² |
| Voronoi tributary | **45.04 in²** | **44.98 in²** |
| B_a from Voronoi | 2.815 k | 2.812 k |

Flat, which is the correct answer: the governing anchor (R2C2) is interior and **spacing-limited**,
not embedment-limited, so extra embedment buys it almost nothing — but it must not lose capacity.

Full Voronoi tributary areas at L_b = 6.656: R1C1 62.41, R1C2 47.96, R1C3 62.41, R2C1 58.78,
R2C2 44.98, R2C3 58.78. Sum = 335.32 = the true union. ✓

**Integration tolerance.** These Voronoi figures come from the grid integrator in §6 and carry
roughly ±0.1 in² of grid noise — the 45.04 → 44.98 step is noise, not a real decrease. The
governing tributary is flat to within tolerance. A closed-form implementation (§4a) is needed to
demonstrate strict monotonicity rather than merely observe it, which is a further argument for the
closed-form route.

### 4a. The machinery already exists in this repo

`tools/anchor-groups/geometry.js` already implements exactly this:

- `voronoiPlanes(index, anchors)` — line 91
- `exactTributaryAptDetail({R, index, anchors, edges})` — line 99
- `exactTributaryApvDetail({R_lbe, R, index, anchors, edges, direction})` — line 105
- `integrateRegion({center, R, halfPlanes, halfCone})` — line 40, adaptive refinement

It was written as a **verification oracle** for the July 2026 audit, not as a design path. The fix
is to promote it: either port the algorithm into the HTML's `computeDiscreteGeometry()`, or derive
a closed-form clipped-circle-vs-half-planes routine (preferable in the browser — the oracle is a
refining integrator and is slower than the calc's render budget allows).

Recommendation: closed-form. The tributary region is a circle clipped by a convex polygon (the
Voronoi cell ∩ the two wall-face half-planes). Standard circle–convex-polygon intersection area is
exact, fast, and has no convergence tolerance to defend in a calc package.

### 4b. Why the audit harness did not catch this

`tools/anchor-groups/run-all.js` asserts only

```
A_pairwise <= A_exact + epsilon
```

i.e. it proves conservatism in **sign** but never bounds its **magnitude**.
`tools/anchor-groups/report.json` records `"maxConservatism": 0.9976559296893421` — the harness saw
and passed geometries where the pairwise area is 0.2% of the exact area, and reported `"pass": true`.

It also logs `conservativeRejections: 111` of 1500 (79 of 500 in the `tow` domain) — geometries
where pairwise drove an area to ≤ 0 and the calc hard-errors. Those are the same failure mode, one
notch further along.

**Add a two-sided assertion** as part of this fix, e.g. `A_pairwise >= 0.75 * A_exact`, and treat
conservative rejections as failures rather than expected outcomes.

---

## 5. Scope of the change — every site that consumes the pairwise areas

Canonical file: `public/Calcs/masonry_anchor_calculator.html` (1738 lines).

| Line | What |
|---|---|
| 420 | `circSeg(R,d)` module-scope helper — shared by calc, diagrams, enumeration |
| 800–929 | `computeDiscreteGeometry()` — the enumeration itself |
| 875–885 | **A_pt pairwise construction** (primary edit) |
| 887–898 | **A_pv pairwise construction** (same defect, same fix) |
| 901–921 | Rejection scan on `Apt <= 0` / `Apv <= 0` and its error text (references "lenses totaling…") |
| 923–924 | `govT` / `govV` selection by minimum area |
| 1083–1126 | Plan/section diagram: governing-anchor callouts, cone rendering |
| 1278–1284 | Per-anchor results table + the "conservative LOWER BOUND" hint + equal-share note |
| 1364–1376 | **Continuous (plf) path** — same truncated formula, `Apt = πLb² − segNear − segFar − 2·Aseg`. Two neighbors only, so the defect is far milder, but it is the same construction. Decide whether to fix or leave. |
| 1384–1387 | Discrete override `Apt = geo.govT.Apt; Apv = geo.govV.Apv` |
| 1424, 1432 | `B_a,mas` and `B_v3` — the consumers |
| 1509–1546 | Shown-work block: prints the π·L_b² − segNear − segFar − Σlens chain term by term. **Must be rewritten** to show the tributary derivation instead. |
| 1542 | "Conservatism:" paragraph — delete/replace |
| 1716, 1720 | Engineering-notes section — equal-share statics note and the pairwise-conservatism note |

Also check the sibling calcs, which use the same construction:

- `public/Calcs/masonry_anchor_bolt_calculator.html` (group mode)
- `public/Calcs/embed_plate_beam_bearing_calculator.html` (grid mode)

Mirror copies that exist on this machine (do **not** edit these; they are stale or read-only refs):
`~/OneDrive - Rohr Engineering/RE CODING/Masonry/masonry_anchor_calculator.html`,
`~/worktrees/masonry-audit/public/Calcs/…`, `~/worktrees/masonry-audit/refs/Masonry/…`.

---

## 6. Reproduction script

Node 18+, run from anywhere. Prints both the current pairwise areas and the true union.

```js
function circSeg(R,d){ if(d>=R) return 0; return R*R*Math.acos(d/R) - d*Math.sqrt(R*R-d*d); }
function run(Lb){
  const b=11.625,o1=3.5,g=5,s=8,cols=3;
  const rows=[{near:o1,far:b-o1},{near:o1+g,far:b-o1-g}];
  let A=[];
  for(let r=0;r<2;r++) for(let c=0;c<cols;c++)
    A.push({row:r+1,col:c+1,x:(c-(cols-1)/2)*s,near:rows[r].near,far:rows[r].far});
  A.forEach(a=>{                                        // current pairwise model
    let lens=0;
    A.forEach(o=>{ if(o===a)return;
      const dx=(o.col-a.col)*s, dy=(o.row===a.row)?0:g, c=Math.hypot(dx,dy);
      if(c<2*Lb) lens+=circSeg(Lb,c/2); });
    a.Apt=Math.PI*Lb*Lb-circSeg(Lb,a.near)-circSeg(Lb,a.far)-lens;
  });
  const N=3000,xmin=-s-Lb-1,xmax=s+Lb+1,dx=(xmax-xmin)/N,dy=b/N;
  let cnt=0, vor=A.map(()=>0);                          // union + Voronoi tributary
  for(let i=0;i<N;i++){ const X=xmin+(i+0.5)*dx;
    for(let j=0;j<N;j++){ const Y=(j+0.5)*dy;
      let hit=false,bi=-1,bd=1e9;
      A.forEach((a,k)=>{ const d=Math.hypot(X-a.x,Y-a.near);
        if(d<=Lb){ hit=true; if(d<bd){bd=d;bi=k;} } });
      if(hit){ cnt++; vor[bi]+=dx*dy; } } }
  const gov=Math.min(...A.map(a=>a.Apt)), govV=Math.min(...vor);
  return { Lb:+Lb.toFixed(4),
    pairwise:A.map(a=>+a.Apt.toFixed(3)), pairwiseGov:+gov.toFixed(3),
    pairwiseSum:+A.reduce((t,a)=>t+a.Apt,0).toFixed(2),
    trueUnion:+(cnt*dx*dy).toFixed(2),
    voronoi:vor.map(v=>+v.toFixed(2)), voronoiGov:+govV.toFixed(2),
    Ba_pairwise:+(1.25*gov*50/1000).toFixed(3), Ba_voronoi:+(1.25*govV*50/1000).toFixed(3) };
}
console.log(run(5.0));
console.log(run(7-0.34375));
```

Expected output is the table in §3/§4. `50` in the `B_a` lines is `√2500 psi`.

---

## 7. Open decisions for the next session (ask Nick)

1. **Fix or document?** The Voronoi fix makes the L_b = 5.00 case ~3% *less* conservative
   (43.56 → 45.00 in²). Any previously-issued run that passed still passes, but sealed calcs
   would no longer reproduce byte-for-byte. Confirm that is acceptable before editing.
2. **Closed-form vs numerical integration** in the browser (see §4a — recommendation: closed-form).
3. **Continuous (plf) path** at line 1371 — fix for consistency, or leave and note the divergence?
4. **Guard vs silent fix.** Suggest adding a visible flag when 3+ cones mutually overlap (i.e.
   `L_b` > the min circumradius over all anchor triples), so the engineer can see the regime
   changed even after the areas are correct.
5. **Sibling calcs** — same change to `masonry_anchor_bolt_calculator.html` and
   `embed_plate_beam_bearing_calculator.html` in the same pass, or separately?
6. **Harness** — add the two-sided `A_pairwise >= 0.75·A_exact` assertion and re-run
   `node tools/anchor-groups/run-all.js`; expect current code to fail it, which is the point.

## 8. Related docs

- `docs/anchor-groups-hand-check-2026-07.md` — independent hand check, July 18 2026. Documents the
  pairwise formulas as the intended implementation and describes the Voronoi oracle as
  "a verification oracle, not the design value". That framing is what this handoff overturns.
- `docs/masonry-audit-decision-register-2026-07.md` — locked audit expectations
  ("one half-lens per neighbor"). **Will need an entry amending that decision.**
- `docs/masonry-audit-2026-07.md`
- `tools/anchor-groups/README.md`

## 9. Deploy

After changes: use the `are-calcs-deploy` skill (commit + push to the `anderson-rohr-calcs` repo,
Vercel picks it up). Do not run git manually.
