# Anchor Groups — Independent Engineering Hand Check

Date: July 18, 2026  
Calculators: `public/Calcs/masonry_anchor_calculator.html` (discrete mode), `public/Calcs/embed_plate_beam_bearing_calculator.html` (grid mode), and `public/Calcs/masonry_anchor_bolt_calculator.html` (group mode)  
Independent calculator: Node.js using `tools/anchor-groups/geometry.js`  
Acceptance tolerance: ±0.5%  
Status: item 18 verification under `docs/plans/PLAN-ANCHOR-GROUPS.md`; for EOR review, not a sealed design.

## Method and notation

Every value below was recomputed from the input data. The calculator HTML was read only to reproduce its formula chain; no value was copied from calculator output and no calculator or tool file was modified. Areas were independently evaluated with the exported `circSeg`, pairwise-area, and exact-oracle functions in `geometry.js`.

For radius `R` and perpendicular chord distance `d`,

`circSeg(R,d) = R² acos(d/R) − d√(R²−d²)` for `d<R`, otherwise zero.

Thus one anchor's pairwise tension area is

`Apt,i = πLb² − Σ face circSeg(Lb,dface) − Σj≠i circSeg(Lb,cij/2)`,

and its shear area in the named shear direction is

`Apv,i = πlbe,i²/2 − Σsame-row,j 0.5 circSeg(lbe,i,cij/2)`.

These are TMS 402-22 §§6.3.2 and 6.3.3 implementations of Eqs. 6-5 and 6-6. Pairwise distances are center-to-center. A deducted `circSeg(Lb,c/2)` is one anchor's half of the full two-circle lens. The exact oracle numerically integrates the circle clipped by masonry boundaries and the anchor's Voronoi half-planes; its reported value is a verification oracle, not the design value.

## 1. Full paper chain — TOW discrete brace, one row by four columns

### 1.1 Given and applicability guards

Given: four anchors in one centered row at `s=8 in`, total service `T=13 kip`, total service `V=13 kip`, `b=7.625 in`, `φ=0.75 in`, `f'm=2.0 ksi=2,000 psi`, `Lb=5 in`, `fy=36 ksi`, input `Fu=58 ksi`, and the one-third increase on, so `k=3/4=0.75`. The rigid attachment is assumed to deliver load through the group centroid with no group moment or torsion; masonry is fully grouted throughout the projected breakout region; wall ends, openings, and orthogonal edges are remote.

1. Effective tensile strength, TMS 402-22 §6.3.8:

   `Fu,eff = min(Fu,1.9fy,125) = min(58,1.9(36),125) = min(58,68.4,125) = 58.000 ksi`.

2. Centered edge distances, TMS 402-22 §6.3.7:

   `lbe,near = lbe,far = b/2 = 7.625/2 = 3.8125 in`.

3. Head-and-cover guard (calculator engineering guard):

   `dreq = 1.1φ+0.5 = 1.1(0.75)+0.5 = 1.325 in`; both `3.8125 ≥ 1.325 in`, pass.

4. Column-spacing guard, TMS 402-22 §6.3.5 plus hardware clearance:

   `smin=max(4φ,2.2φ+0.5)=max(4(0.75),2.2(0.75)+0.5)=max(3.000,2.150)=3.000 in`; `8.000 ≥ 3.000 in`, pass.

5. Minimum embedment, TMS 402-22 §6.3.6:

   `Lb,min=max(4φ,2)=max(4(0.75),2)=3.000 in`; `Lb/Lb,min=5/3=1.667`, pass, or requirement D/C `=3/5=0.600`.

### 1.2 Per-anchor projected tension area Apt

Base circle, TMS 402-22 Eq. 6-5:

`πLb²=π(5²)=78.539816 in²`.

Each masonry-face deduction is

`circSeg(5,3.8125)=5²acos(3.8125/5)−3.8125√(5²−3.8125²)=5.257485 in²`.

At `c=8 in`, each overlapping neighbor contributes

`circSeg(5,8/2)=5²acos(4/5)−4√(5²−4²)=4.087528 in²`.

All pairwise distances are explicitly enumerated below. Distances `c≥2Lb=10 in` have zero lens.

| Anchor | Pairwise distances to the other anchors (in) | Face terms (in²) | Nonzero lens terms (in²) | Apt substitution | Apt (in²) |
|---|---:|---:|---:|---|---:|
| 1, left end | `8,16,24` | `5.257485+5.257485` | `4.087528+0+0` | `78.539816−10.514969−4.087528` | `63.937319` |
| 2, left interior | `8,8,16` | `5.257485+5.257485` | `4.087528+4.087528+0` | `78.539816−10.514969−8.175055` | `59.849791` |
| 3, right interior | `16,8,8` | `5.257485+5.257485` | `0+4.087528+4.087528` | `78.539816−10.514969−8.175055` | `59.849791` |
| 4, right end | `24,16,8` | `5.257485+5.257485` | `0+0+4.087528` | `78.539816−10.514969−4.087528` | `63.937319` |

Therefore, by TMS 402-22 §§6.3.2 and 8.1.4.3.1, `Apt,gov=min(Apt,i)=59.849791 in²`, at Anchors 2 and 3.

**Recorded-value cross-check:** end `63.937319` and interior `59.849791 in²` both match the reviewer-recorded calculator values exactly to six decimals. No mismatch.

### 1.3 Per-anchor projected shear area Apv

The centered half-cone base is, TMS 402-22 Eq. 6-6,

`πlbe²/2=π(3.8125²)/2=22.831770 in²`.

For every possible same-row pair, `c=8,16,or 24 in`, while `2lbe=7.625 in`; therefore every `0.5 circSeg(lbe,c/2)=0`. Consequently Anchors 1 through 4 each have

`Apv,i=22.831770−0=22.831770 in²`, and `Apv,gov=22.831770 in²` by TMS 402-22 §§6.3.3 and 8.1.4.3.2.

### 1.4 Threaded area and anchor tension capacity Ba

For a 3/4-in UNC anchor, `nt=10 threads/in`. TMS 402-22 Eq. 6-7 gives

`dnet=φ−0.9743/nt=0.75−0.9743/10=0.652570 in`,

`Ab=0.7854dnet²=0.7854(0.652570²)=0.334461 in²`.

TMS 402-22 §8.1.4.3.1:

`Ba,mas=1.25Apt√f'm/1000=1.25(59.849791)√2000/1000=3.345705 kip`,

`Ba,steel=0.5AbFu=0.5(0.334461)(58)=9.699361 kip`,

`Ba=min(3.345705,9.699361)=3.345705 kip` (masonry breakout governs).

### 1.5 Anchor shear capacity Bv1 through Bv4

TMS 402-22 Eq. 8-4:

`Bv1=1.25Apv√f'm/1000=1.25(22.831770)√2000/1000=1.276335 kip` (masonry breakout).

TMS 402-22 Eq. 8-5:

`Bv2=580(Ab f'm)^0.25/1000=580(0.334461×2000)^0.25/1000=2.949659 kip` (masonry crushing).

TMS 402-22 Eq. 8-6:

`Bv3=2.5Apt√f'm/1000=2.5(59.849791)√2000/1000=6.691410 kip` (pryout).

TMS 402-22 §8.1.4.3.2:

`Bv4=0.25AbFu=0.25(0.334461)(58)=4.849680 kip` (anchor steel).

Thus `Bv=min(1.276335,2.949659,6.691410,4.849680)=1.276335 kip`; masonry shear breakout governs.

### 1.6 Equal-share demand, interaction, verdict, and margin

Rigid-group equal sharing gives raw per-anchor demands

`Ta=T/N=13/4=3.250 kip`, and `Va=V/N=13/4=3.250 kip`.

With the IBC 1605.2 one-third increase represented on the demand side,

`kTa=kVa=0.75(3.250)=2.437500 kip`.

Individual checks are:

`tension D/C=kTa/Ba=2.437500/3.345705=0.728546`, pass;

`shear D/C=kVa/Bv=2.437500/1.276335=1.909765`, fail.

TMS 402-22 §8.1.4.3.3, Eq. 8-8:

`IR=(kTa/Ba)^(5/3)+(kVa/Bv)^(5/3)`

`=(2.437500/3.345705)^(5/3)+(2.437500/1.276335)^(5/3)`

`=0.589877+2.939680=3.529557 > 1.000`, fail.

**Verdict: the connection does not work for the stated loads and geometry.** The governing interaction is `3.529557`; it exceeds the permissible value by `3.529557−1=2.529557`, or 252.96% of the limit. Equivalently, the available interaction margin is `1−3.529557=−2.529557`, and the reciprocal capacity index is `1/3.529557=0.283322` (28.33%). The controlling standalone mode is masonry shear breakout, whose capacity shortfall is `1.276335−2.437500=−1.161165 kip/anchor`.

## 2. Area-level checks

### 2.1 Case (a): TOW two rows by four columns

Inputs: `b=11.625`, row-1 offset `o1=2.5`, gauge `g=6.625`, `s=6`, and `Lb=5 in`. Row coordinates measured from the near face are `2.5` and `2.5+6.625=9.125 in`; each row is 2.5 in from its nearer wall face. The common terms are:

`π(5²)=78.539816`; face term `circSeg(5,2.5)=15.354621`; same-row term at `c=6`, `circSeg(5,3)=11.182380`; cross-row term at `c=6.625`, `circSeg(5,3.3125)=8.759786`; diagonal term at `c=√(6²+6.625²)=8.938156`, `circSeg(5,4.469078)=1.604885 in²`. Terms at `c≥10 in` are zero.

For an end anchor, the nonzero distances are `6`, `6.625`, and `8.938156`:

`Apt,end=78.539816−15.354621−11.182380−8.759786−1.604885=41.638143 in²`.

For an interior anchor, nonzero distances are `6,6,6.625,8.938156,8.938156`:

`Apt,int=78.539816−15.354621−2(11.182380)−8.759786−2(1.604885)=28.850877 in²`.

| Anchor | Position | All pair distances (in) | Apt hand (in²) | geometry.js (in²) |
|---|---|---|---:|---:|
| 1 | Row 1 end | `6,12,18,6.625,8.938156,13.707320,19.180475` | 41.638143 | 41.638143 |
| 2 | Row 1 interior | `6,6,12,8.938156,6.625,8.938156,13.707320` | 28.850877 | 28.850877 |
| 3 | Row 1 interior | symmetric to 2 | 28.850877 | 28.850877 |
| 4 | Row 1 end | symmetric to 1 | 41.638143 | 41.638143 |
| 5 | Row 2 end | symmetric to 1 | 41.638143 | 41.638143 |
| 6 | Row 2 interior | symmetric to 2 | 28.850877 | 28.850877 |
| 7 | Row 2 interior | symmetric to 2 | 28.850877 | 28.850877 |
| 8 | Row 2 end | symmetric to 1 | 41.638143 | 41.638143 |

For row 1, `lbe=2.5`, so `2lbe=5<s`; no shear lenses and every anchor has `Apv=π(2.5²)/2=9.817477 in²`.

For row 2, `lbe=9.125`; the half-lens terms are `0.5circSeg(9.125,3)=38.523141`, `0.5circSeg(9.125,6)=14.898405`, and `0.5circSeg(9.125,9)=0.125606 in²`. Hence

`Apv,row2,end=π(9.125²)/2−38.523141−14.898405−0.125606=77.246186 in²`,

`Apv,row2,interior=π(9.125²)/2−2(38.523141)−14.898405−0.125606=38.848651 in²`.

The governing design shear area is the near-row value, `9.817477 in²`.

Reviewer-recorded 2×2 spot check with the same inputs: removing the extra columns leaves `Apt=41.638143`; row-1 `Apv=9.817477`; and row-2 `Apv=π(9.125²)/2−38.523141=92.270197 in²`. All three match the recorded values exactly to six decimals. No mismatch.

### 2.2 Case (b): embed 1×1 at defaults

Defaults are `Lb=6 in` and remote shear edge `lbe=12 in`; there are no neighbors and `circSeg(6,12)=0`.

`Apt=π(6²)−0=113.097336 in²` by TMS 402-22 Eqs. 6-5 and §6.3.2.

`Apv=π(12²)/2=226.194671 in²` by TMS 402-22 Eq. 6-6 and §6.3.3.

Both values equal `geometry.js` to the shown precision.

### 2.3 Case (c): embed 1×2 (2H) at defaults

Defaults are `Lb=6`, `Sx=5`, and `lbe=12 in`. The sole tension lens is

`circSeg(6,2.5)=6²acos(2.5/6)−2.5√(6²−2.5²)=27.440862 in²`.

Each anchor therefore has `Apt=π(6²)−27.440862=85.656473 in²`.

The shear half-lens is `0.5circSeg(12,2.5)=83.315785 in²`, so each anchor has

`Apv=π(12²)/2−83.315785=142.878886 in²`.

Both anchors and both values match `geometry.js`.

### 2.4 Case (d): embed 3×2 vertical six-anchor preset

Use the preset baseline `Hp=16`, `et=eb=2`, `Sx=5`, `Wp=8`, `Lb=6 in`. The three vertical rows are uniformly spaced at

`r=(Hp−et−eb)/(rows−1)=(16−2−2)/(3−1)=6.000 in`.

Number anchors row-major: Anchors 1–2 are the top row, 3–4 the middle row, and 5–6 the bottom row. The masonry free edge is remote for this area check, so there is no face deduction. The nonzero pairwise terms are

| Neighbor relation | Center distance `c` (in) | Deduction per anchor, `circSeg(6,c/2)` (in²) |
|---|---:|---:|
| Same row, opposite column | 5.000000 | 27.440862 |
| Adjacent row, same column | 6.000000 | 22.110655 |
| Adjacent-row diagonal | 7.810250 | 13.246456 |
| Two rows apart, same column | 12.000000 | 0.000000 |
| Two rows apart, diagonal | 13.000000 | 0.000000 |

The complete per-anchor check is:

| Anchor | Row / column | Pairwise expression (in²) | `Apt` (in²) | `geometry.js` (in²) |
|---:|---|---|---:|---:|
| 1 | top / left | `113.097336−27.440862−22.110655−13.246456` | 50.299363 | 50.299363 |
| 2 | top / right | `113.097336−27.440862−22.110655−13.246456` | 50.299363 | 50.299363 |
| 3 | middle / left | `113.097336−27.440862−2(22.110655)−2(13.246456)` | 14.942253 | 14.942253 |
| 4 | middle / right | `113.097336−27.440862−2(22.110655)−2(13.246456)` | 14.942253 | 14.942253 |
| 5 | bottom / left | `113.097336−27.440862−22.110655−13.246456` | 50.299363 | 50.299363 |
| 6 | bottom / right | `113.097336−27.440862−22.110655−13.246456` | 50.299363 | 50.299363 |

The dense middle-row anchors govern at `14.942253 in²`. Direct Node evaluation through `tools/anchor-groups/geometry.js` gives full-precision pairwise values of `50.29936327152831 in²` at the four corners and `14.942253108182694 in²` at the two middle-row anchors. No mismatch.

The pairwise result is deliberately conservative because its adjacent-row and diagonal deducted regions overlap. Section 5 cross-checks both anchor types against the exact oracle and shows that the dense middle-row margin is especially large.

### 2.5 Case (e): SD four-bolt line

Inputs: `s=8`, `Lb=5.5`, `lbe=7.625 in`. Base tension circle `π(5.5²)=95.033178 in²`; adjacent lens

`circSeg(5.5,4)=5.5²acos(4/5.5)−4√(5.5²−4²)=7.783137 in²`.

Distances of `16` and `24 in` exceed `2Lb=11 in` and contribute zero. Thus

`Apt,end=95.033178−7.783137=87.2500410054 in²`,

`Apt,interior=95.033178−2(7.783137)=79.4669042397 in²`.

The shear base is `π(7.625²)/2=91.327080 in²`; adjacent half-lens

`0.5circSeg(7.625,4)=0.5[7.625²acos(4/7.625)−4√(7.625²−4²)]=16.626773 in²`.

Therefore

`Apv,end=91.327080−16.626773=74.7003070135 in²`,

`Apv,interior=91.327080−2(16.626773)=58.0735338395 in²`.

All four values match both `geometry.js` and the reviewer-recorded calculator values to all shown digits. No mismatch.

## 3. One-row embed FBD equilibrium — both load cases

For the 3×2 preset baseline, the unified row pitch and couple arm give

`r=(Hp−et−eb)/(rows−1)=(16−2−2)/2=6.000 in`,

`y=(rows−1)r+e_edge−ac/2=(3−1)(6)+2−1/2=13.500 in`.

The couple is credited to the **extreme row only**: the top row for Case 1 gravity with bottom-edge bearing, and the bottom row for Case 2 reversal with top-edge bearing. Each extreme-row anchor carries `P/N+Tc/cols`; each middle-row anchor carries only the concentric direct share `P/N`. No couple tension is assigned to the intermediate row.

Use the default one-row, two-column layout: `Hp=12`, `et=1.5`, derived `eb=Hp−et=10.5`, `ac=1`, `e=2 in`, `P=0`; Case 1 has `V1=15 kip`, Case 2 has `V2=6 kip`. There are `cols=2` and `N=2` anchors.

### Case 1 — gravity/down, bearing at bottom

The anchor-row-to-bearing-centroid arm is

`y1=eb−ac/2=10.5−1/2=10.000 in`.

Moment demand about the bearing centroid is `M1=V1e=15(2)=30.000 kip-in`; hence

`Tc,1=M1/y1=30/10=3.000 kip`, and each bolt receives `T1=P/N+Tc,1/cols=0/2+3/2=1.500 kip`.

Force equilibrium: `ΣFx=Tc,1−C1=3−3=0`, so `C1=3.000 kip`. Moment equilibrium about the bearing centroid:

`ΣM=Tc,1y1−V1e=3(10)−15(2)=30−30=0 kip-in`.

### Case 2 — reversal, bearing at top

The arm is

`y2=et−ac/2=1.5−1/2=1.000 in`.

`M2=V2e=6(2)=12.000 kip-in`; therefore

`Tc,2=M2/y2=12/1=12.000 kip`, and `T2=P/N+Tc,2/cols=0/2+12/2=6.000 kip/bolt`.

Force equilibrium: `ΣFx=Tc,2−C2=12−12=0`, so `C2=12.000 kip`. Moment equilibrium about the bearing centroid:

`ΣM=Tc,2y2−V2e=12(1)−6(2)=12−12=0 kip-in`.

The required mechanism guard is `y>0`. If `eb−ac/2≤0` in Case 1 or `et−ac/2≤0` in Case 2, the tension row has no positive lever arm to the bearing resultant; `Tc=M/y` is undefined/nonphysical at zero and reverses sense below zero. The calculator must stop rather than report a capacity.

## 4. Embed 2×2 legacy-versus-strip plate-bending benchmark

Use the default Case 1 values from the existing hand check: `K=0.5`, total tension-row force `Trow=3.000 kip`, `a=Hp/2−et=12/2−1.5=4.500 in`, `Wp=8.000 in`, and plate `t=0.500 in`. This comparison is raw formula stress; applying a common `k=0.75` would multiply both results equally.

Deployed full-width model:

`Mlegacy=K Trow a=0.5(3.000)(4.500)=6.750 kip-in`,

`Slegacy=Wp t²/6=8(0.5²)/6=0.333333 in³`,

`flegacy=Mlegacy/Slegacy=6.750/0.333333=20.250 ksi`.

New two-strip model: each strip has `Trow/2=1.500 kip` and `Wp/2=4.000 in`, so

`Mstrip=K(Trow/2)a=0.5(1.500)(4.500)=3.375 kip-in`,

`Sstrip=(Wp/2)t²/6=4(0.5²)/6=0.166667 in³`,

`fstrip=Mstrip/Sstrip=3.375/0.166667=20.250 ksi`.

Algebraically,

`[K(Trow/2)a]/[(Wp/2)t²/6] = [K Trow a]/[Wp t²/6]` because the factor `1/2` cancels. Numerically the results are identical: `20.250/20.250=1.000000`.

The strip-model basis is limited and explicit: tributary widths are bounded by column midpoints and plate edges and sum to `Wp`. The model applies the deployed `M=KTa` form to each anchor's tributary strip as a conservative demand estimate. It makes **no strip-level ΣF or ΣM equilibrium claim**, consistent with the plan.

## 5. Conservatism appendix — pairwise versus exact oracle

The pairwise design method subtracts every face segment and every anchor-pair half-lens independently. Where deducted regions overlap one another, that common region is subtracted more than once. The exact oracle instead clips the anchor circle by masonry and by all Voronoi half-planes, so it counts each physical point once. Accordingly the closed-form pairwise area is intended as a lower bound on exact tributary area. Small apparent reversals smaller than the oracle's stated integration error are numerical integration uncertainty, not a violation of the bound.

### Case (a), TOW 2×4

| Anchor type | Pairwise Apt (in²) | Exact-oracle Apt (in²) | Oracle error bound (in²) | Conservatism margin `exact−pair` (in²) | Margin / exact |
|---|---:|---:|---:|---:|---:|
| End, Anchors 1,4,5,8 | 41.638143 | 44.695663 | ±0.269699 | 3.057520 | 6.841% |
| Interior, Anchors 2,3,6,7 | 28.850877 | 34.899521 | ±0.230789 | 6.048644 | 17.332% |

### Case (d), embed 3×2 vertical preset

| Anchor type | Pairwise Apt (in²) | Exact-oracle Apt (in²) | Oracle error bound (in²) | Conservatism margin `exact−pair` (in²) | Margin / exact |
|---|---:|---:|---:|---:|---:|
| Corner/extreme-row, Anchors 1,2,5,6 | 50.299363 | 67.597778 | ±0.409790 | 17.298415 | 25.590% |
| Dense middle-row, Anchors 3,4 | 14.942253 | 49.592834 | ±0.340027 | 34.650581 | 69.870% |

Both required cases satisfy `Apt,pairwise < Apt,exact` by margins well above the oracle error. For the 3×2 case, the exact values above come from `exactTributaryAptDetail` in the same fresh Node run as the pairwise values. The dense middle-row result is the interesting case: its `34.650581 in²` margin is more than 100 times the `±0.340027 in²` oracle error bound. This is the expected cost of retaining every adjacent-row and diagonal deduction as a transparent conservative lower bound.

## Summary cross-check

| Case | Governing quantity | Hand value | Calc / geometry.js value | Match |
|---|---|---:|---:|---|
| TOW 1×4 @ 8 | Apt end | 63.937319 in² | 63.937319 in² recorded | Yes |
| TOW 1×4 @ 8 | Apt interior, governing | 59.849791 in² | 59.849791 in² recorded | Yes |
| TOW 1×4 @ 8 | Apv governing | 22.831770 in² | 22.831770 in² | Yes |
| TOW brace full chain | Eq. 8-8 interaction | 3.529557, fail | 3.530 calculator-chain value | Yes |
| TOW 2×4 | Apt interior, governing | 28.850877 in² | 28.850877 in² | Yes |
| TOW 2×2 recorded spot check | Apt | 41.638143 in² | 41.638143 in² recorded | Yes |
| TOW 2×2 recorded spot check | Apv row 1 / row 2 | 9.817477 / 92.270197 in² | 9.817477 / 92.270197 in² recorded | Yes |
| Embed 1×1 | Apt / Apv | 113.097336 / 226.194671 in² | same | Yes |
| Embed 1×2 (2H) | Apt / Apv | 85.656473 / 142.878886 in² | same | Yes |
| Embed 3×2 vertical preset | Apt corner / middle governing | 50.299363 / 14.942253 in² | 50.299363 / 14.942253 in² | Yes |
| Embed 3×2 vertical preset | `r` / couple arm `y` | 6.000 / 13.500 in | same formula chain | Yes |
| Embed 3×2 exact oracle | Apt corner / middle | 67.597778 ±0.409790 / 49.592834 ±0.340027 in² | same fresh oracle run | Yes |
| SD four-bolt line | Apt end / interior | 87.2500410054 / 79.4669042397 in² | same recorded | Yes |
| SD four-bolt line | Apv end / interior | 74.7003070135 / 58.0735338395 in² | same recorded | Yes |
| Embed one-row Case 1 | `Tc y` versus `Ve` | 30.000 = 30.000 kip-in | calculator chain closes | Yes |
| Embed one-row Case 2 | `Tc y` versus `Ve` | 12.000 = 12.000 kip-in | calculator chain closes | Yes |
| Embed 2×2 plate benchmark | full width / strip stress | 20.250 / 20.250 ksi | algebraically identical | Yes |

No reviewer-recorded mismatch was found. Had any mismatch occurred, it would be identified here as a blocking discrepancy rather than reconciled silently.

Prepared by: Claude + Codex (cross-model), 2026-07-18. For EOR review.
