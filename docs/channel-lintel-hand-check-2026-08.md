# Hand check — Steel Channel Lintel at a New Opening in Masonry

_Fixture B · 2026-08-19 · against `PLAN-CHANNEL-LINTEL.md` rev 12_

Longhand verification of the engineering the reference Tedds calc does **not** cover. Fixture A
(reference reproduction) and Fixture C (machine assertions) live in
`public/Calcs/js/channel_lintel_fixtures.js` and run headless with
`node public/Calcs/js/channel_lintel_fixtures.js`.

Reference geometry throughout: MC18x42.7, 8" CMU (`t = 7.625`, `t_w = 0.45`), `L = 28 ft`,
`s = 16"`, 2 rows at `g = 12"`, 3/4" A307 rod, `f'm = 1900 psi`, `w_cmu = 70 psf`, `H_above = 16 ft`,
`p = 30 psf` over a 5 ft tributary, `jamb_n = 5`. The reference-case PASS verdict quoted throughout is
at **`jamb_n = 5`**; the Fixture A/C default is `jamb_n = 4`, which is what the 1.075 jamb FAIL row in
§6 refers to.

---

## 1. Section properties (AISC v16.0)

`A = 12.6`, `d = 18.0`, `t_w = 0.45`, `x̄ = 0.877`, `e_o = 0.969`, `I_x = 554`, `I_y = 14.3`,
`S_y = 4.64`, `J = 1.23`, `C_w = 852`. All ten reproduce exactly from the xlsx and are asserted as an
engine startup self-test.

**`e_o` datum, verified not assumed.** The channel shear-centre offset from the web centreline is

```
e_cl = 3·t_f·b'² / (6·b'·t_f + h·t_w)      b' = b_f − t_w/2 = 3.725,  h = d − t_f = 17.375
     = 3(0.625)(3.725²) / (6(3.725)(0.625) + 17.375(0.45))
     = 26.02 / 21.79 = 1.194 in
```

Less `t_w/2 = 0.225` gives **0.969 in from the back of the web — the tabulated `e_o` exactly.**
Checked across all 72 C and MC shapes: worst error **0.64%** (MC13x40). So `e_o` is measured from the
back of the web on the flange-opposite side, and the bolt-line-to-shear-centre distance is

```
e = e_o + t_w/2 = 1.194 in
```

---

## 2. Torsion couple — full free body

Load arrives at the rod line but the shear centre sits `e` behind it, so there is a distributed torque
`w_ch·e`. Axes: `x` span, `y` up, `z` out of face 1.

- Channel A (face 1, flanges toward +z): `M_x,A = +w_ch·e` per unit length.
- Channel B, mirrored: `M_x,B = −w_ch·e`. **Opposite about global x.**

Resisting couple on A from rod forces at `y = ±g/2`: `M_x = (g/2)(F_top − F_bot)`. Setting this equal
to `−w_ch·s·e` gives `F_top = −w_ch·s·e/g` — the rod pulls A **toward** the wall, i.e. rod tension —
and `F_bot = +w_ch·s·e/g`, which is masonry bearing outward. Repeating for B gives `F_top,B` also
toward the wall.

**Both channels tension the same (top) rod, from opposite ends. The torques reinforce; they do not
cancel.** Rod tension is the single value

```
ΔF = w_ch·s·e/g = (0.672/12)(16)(1.194)/12 = 0.0891 kip
```

Asserted as statics in Fixture C: `ΔF·g = w_ch·s·e` to machine precision.

A single row could not have resisted this at all — the channel would have been left in St. Venant
torsion needing AISC H3.3. This is the reason for two rows.

---

## 3. Rod bending — the check the reference never made

### 3.1 Gravity plane

The rod is loaded by distributed grout bearing over `t` and reacted at the two channel webs at
`±L_g/2`, `L_g = t + t_w = 8.075 in`:

```
P_rod  = w_total·s/rows = (1.344)(16/12)/2 = 0.896 kip
M_grav = (P_rod/2)(L_g/2 − L_c/4) = (0.448)(4.0375 − 1.90625) = 0.955 kip-in
```

### 3.2 Wind plane — composite mode only

Two opposed end shears `±V_x` separated across the wall form a net couple `V_x·L_g`, so the rod bends
in double curvature and **distributed grout bearing is required to equilibrate it**. With an
antisymmetric uniform reaction `±k` over a centred contact length `L_c`:

```
couple equilibrium:  k(L_c/2)² = V_x·L_g     →  k = 4·V_x·L_g/L_c²
zero shear at:       s* = V_x/k = L_c²/(4·L_g)
max moment:          M_wind = V_x(L_u + s*/2)
```

Bounds, both verified: `L_u = 0` → `V_x·L_g/8`; `L_c → 0` → `V_x·L_g/2`, exactly 4× apart. Grout
exists only across `t`, so `L_c ≤ t` and `L_u ≥ t_w/2` are enforced — `L_u = 0` is a formula check,
never a design state, and `L_c → 0` is singular (`k → ∞`) and must always fail grout bearing.

At the physical bound: `L_u = 0.225`, `L_c = 7.625`, `s* = 1.800`, `k = 0.946 kip/in`,
`V_x = q·s/rows = 1.704 kip`, `M_wind = 1.917 kip-in`.

### 3.3 Combined, three actions, two planes

```
M_res = √(M_wind² + M_grav²)   V_res = √(V_x² + V_y²)   N_rod = T_w + ΔF
σ = N_rod/A_b + M_res/S_rod    τ = 4·V_res/(3·A_b)      √(σ² + 3τ²) ≤ 0.90·F_y
```

`S_rod = πd³/32 = 0.04142 in³`. **Composite mode, 16" o.c.:** `M_res = 2.142`, `σ = 52.14`,
`τ = 5.32`, **vM = 52.9 ksi against 32.4 — DCR 1.63.**

**Non-composite (the shipping basis):** `V_x = 0`, so `M_res = M_grav = 0.955`, giving **vM ≈ 23 ksi,
DCR 0.72.** Adequate — but it is the tightest connector item, and the reference calc never checked it.

The implied pure-shear limit of this formulation is `0.39·F_y·A_b`, more conservative than
`φ0.6F_yA_b`; stated on the sheet so the two are not read as contradictory.

---

## 4. Grout bearing — governs composite mode

```
A_br = d_b·L_c    f_g = k/d_b    allowable = φ(0.8 f'm) = 0.60(0.8)(1.9) = 0.912 ksi
```

At 16" o.c.: `f_g = 0.946/0.75 = 1.262 ksi`, **DCR 1.38**. Because `k` is independent of `d_b`,
a 1" rod gives `0.946 ksi` — **still 1.04, still failing.**

| lever | effect on `f_g` |
|---|---|
| rod **grade** | none — `f_g` untouched |
| rod **diameter** | linear, `f_g = k/d_b` |
| **spacing** | linear, halving `s` halves `V_x` and `k` |

At 8" o.c. the 3/4" A307 rod passes both grout (0.69) and rod steel (0.82).

---

## 5. Staged slip — why composite action is not the design basis

Pre-engagement the two channels bend **independently about their own centroids**, so the relative
longitudinal displacement at the rod is governed by each channel's own centroid-to-web offset:

```
ζ_A = t_w/2 − x̄     ζ_B = x̄ − t_w/2     relative lever = 2(x̄ − t_w/2) = 1.304 in
```

**not** `2·z_ch = 9.379 in`, which would assume the composite plane-section behaviour whose onset it is
trying to predict — circular, and it overstates the lever 7.2×.

```
θ_end = w·L³/(24·E·2I_y)    w_slip solves  θ_end·1.304 = c_h
```

| channel-web hole | `c_h` | `w_slip` | engages at `w_w` = 0.150 klf? |
|---|---|---|---|
| standard 1/16" | 0.0625 | 0.302 klf | **no** |
| reamed 1/32" | 0.03125 | 0.151 klf | **no** |
| welded | ~0 | 0 | yes |

Epoxy in the **masonry annulus** does not help: longitudinal shear crosses the **channel-web hole**.
Only a welded shear plate makes composite action real, and no weld design exists here — hence
composite mode is informational, carries no verdict, and is excluded from the optimiser.

---

## 6. Shipping basis — non-composite, reference case, `L_b = 16 in` assumed (shipped default is full span)

Wind serviceability at the IBC Table 1604.3 minimum (`L/240` at `0.42W`, note f). `L/600` is retained
for gravity, where TMS 4.6 mandates it.

Every row below is computed at `L_b = 16"` — the engineer-stated bracing assumption, **not** the
shipped `L_b` default, which is the full span and fails gravity flexure at DCR 1.092. `jamb_n = 5`
except where the table says otherwise.

| check | value | DCR |
|---|---|---|
| Gravity flexure, F2, `L_b = 16"` | — | 0.350 |
| Shear, G2 | — | 0.064 |
| Wind flexure, F6 | — | 0.367 |
| H1-1b, `P_r = 0` | — | 0.716 |
| **Rod combined, gravity only** | vM ≈ 23 ksi | **0.783** |
| Grout bearing | — | 0.185 |
| Jamb bolt group, 4 bolts | — | **1.075 FAIL** |
| Jamb bolt group, 5 bolts | — | pass |
| Gravity deflection, L/600 | — | 0.926 |
| Wind deflection, 0.42W vs L/240 | — | 0.750 |

Cross-checks against Tedds that **do** reproduce: `φM_n,x = 202.77` vs 202.8 k-ft (0.01%),
`φV_n = 157.46` vs 157.5 kip (0.02%), flexure DCR 0.350 vs 0.359, shear 0.064 vs 0.066, gravity
deflection 0.926 vs 0.964.

**Optimiser result:** MC18x42.7 @ 16" o.c. with **5 jamb bolts** — the reference's own section and
spacing, plus the one extra jamb bolt the min-of-all-limit-states masonry basis requires.

---

## 7. Open items carried forward

1. **Phase 0 gate — NOT closed.** Tedds' `M_u = 72.7 k-ft` back-solves to `w = 0.7418 klf`;
   `1.2(1120/2 + 42.7) = 0.7235` (−2.5%). Best fit is Tedds' own displayed member UDL of 0.57 klf plus
   self weight (−0.64%), so the residual sits in an input step not visible in the export. Fixture A is
   **formally split** as the plan requires, and **no claim of 2% reference reproduction is made** in
   the UI or the docs.
2. **AISC Appendix 6.** The automatic "`L_b = s` because rods exist" reduction stays disabled; no code
   path computes a brace reduction. `L_b` is an ordinary engineer input defaulting to the full span,
   and any lower value raises a warning. A hard full-span lock was tried first and rejected during the
   build: it drops `φM_n,x` from 202.8 to 64.9 k-ft and fails every real job.
3. **Tedds under-checked the combinations.** It ran only `1.2D+1.6SL`. Here **`1.4D` governs** gravity.
4. **Jamb bolt-group eccentricity `e_group`** is modelled (cross-check round 1 fix, 2026-08-19) by
   the elastic vector method: reaction at the opening face, extreme bolt = `R/n + R·e_group·x_max/Σd²`.
   For the reference layout (pitch 8", edge 4") this amplifies the extreme-bolt demand ×3.4 (n=4) /
   ×3.5 (n=5) over `R/n`, and the jamb group now governs the reference case at DCR 3.5 — the §6 table
   pre-dates this. Reaction unbalance between faces (plan item 32) is still not modelled.
5. **Bond beam** flexure uses a simplified `j·d = 0.9d`.

---

## Note — 2026-08-19, cross-check round 1

Cross-check round 1 (see `PLAN-CHANNEL-LINTEL-REVIEW-LOG.md`) found that the engine evaluated every
check at a **single heuristic-selected load combination** rather than enveloping all ten, and that the
jamb check omitted **bolt-group eccentricity**. Both are being fixed.

**The DCRs in the §6 table pre-date those fixes and the pinned values are being re-derived. Do not
quote this table without that caveat.**
