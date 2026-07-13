# Calc 2 — Chevron-Effect Method Transcription

**Source:** Fortney, P.J. and Thornton, W.A. (2017), "The Chevron Effect and Analysis of
Chevron Beams — A Paradigm Shift," *Engineering Journal*, AISC, Q4 2017, pp. 263–296.
(Builds on Fortney & Thornton 2015, "The Chevron Effect — Not an Isolated Problem.")

**Status:** BLOCKING pre-build transcription. Reproduced numerically in
`validate-calc2-chevron.mjs` (Example Problem 1, both load cases) — match within 1%.

This document is the *single source of truth* for the chevron-effect check wired into
`public/Calcs/brace_connection_at_column_on_beam_calculator.html`. The calculator's
`chevronLocal()` routine implements exactly the equations below with the same symbols.

---

## 1. Sign convention (paper "Sign Convention" section, p. 263)

Forces on the gusset(s) acting **to the right or upward**, and **clockwise** moments acting
on the gusset(s), are **positive**. All equations below are signed. Consequently:

- A downward net unbalanced vertical force gives a downward-acting `w` on the beam.
- The left beam end reaction `R1` can be positive or negative.
- `Vmax`, `Mmax` retain sign; envelopes compare magnitudes but the reported value keeps its sign.

## 2. Geometry symbols

| Symbol | Meaning | Units |
|---|---|---|
| `L` | beam span (support to support) | in |
| `a` | distance from **left** support to the work point (w.p.) | in |
| `b` | distance from **right** support to the w.p.; `a + b = L` | in |
| `Lg` | gusset-to-beam interface length (along the beam) | in |
| `a'` | distance from left support to the **left edge of the gusset** `= a − Lg/2` | in |
| `eb` | half beam depth `= d/2` — transport arm of horizontal interface force to the beam gravity axis | in |
| `Δ` (delta) | horizontal offset of the gusset-to-beam interface centroid from the w.p. `= ½(L1 − L2)` (Eq 1); `Δ = 0` when the interface is centered under the w.p. | in |
| `x1` | coordinate measured from the **left edge** of the gusset (left half), `0 ≤ x1 ≤ Lg/2` | in |
| `x2` | coordinate measured from **mid-length** of the gusset (right half), `0 ≤ x2 ≤ Lg/2` | in |

**Subscripts `t` / `b`** denote forces delivered to the **top** and **bottom** sides of the
beam respectively. In the column-on-beam node the brace gusset attaches to the **top flange**,
so top-side quantities carry the brace force and bottom-side quantities are zero
(`ΣVb = ΣHb = 0`, `(Ma-a)b = 0`). The full two-sided form is transcribed for fidelity and the
single-sided reduction is the case the calculator runs.

## 3. Interface resultant forces

`ΣVt`, `ΣHt` = algebraic sum of the vertical / horizontal components of the brace force(s)
delivered to the top interface (Eq 11–12: `(Ha-a)t = −(H1+H2)t`, `(Va-a)t = −(V1+V2)t`; the
section a-a forces are the negatives of the applied interface resultants — the interface
resultant delivered to the beam is `(H1+H2)t = ΣHt`, `(V1+V2)t = ΣVt`).

    ΣV_T = ΣVt + ΣVb            (Eq 21)   — total unbalanced vertical force
    ΣH_T = ΣHt + ΣHb                      — total net horizontal (collector) force

## 4. Interface moments `Ma-a` (plastic transport of interface forces to gravity axis)

    (Ma-a)t = (ΣH)t · eb + (ΣV)t · Δ      (Eq 13)
    (Ma-a)b = (ΣV)b · Δ − (ΣH)b · eb      (Eq 4)
    MT      = (Ma-a)t + (Ma-a)b           (Eq 27 total for chevron-dominance test)

Physical meaning: the horizontal interface force is applied at the flange, eccentric by `eb`
from the beam neutral axis, producing the local interface moment that drives the chevron
effect. This is the term RISA's beam-line analysis omits.

## 5. Distributed loads on the beam (symbiotic model, p. 268–269)

The unbalanced vertical force is smeared uniformly over `Lg`; the interface moment is
distributed as a **plastic** (uniform-intensity, opposite sign each half) load producing a
higher intensity on the tension half. The net transverse intensities on the left and right
halves of the gusset are:

    wl = −4(Ma-a)t/Lg² − 4(Ma-a)b/Lg² + (ΣV)t/Lg + (ΣV)b/Lg    (Eq 22)
    wr = +4(Ma-a)t/Lg² + 4(Ma-a)b/Lg² + (ΣV)t/Lg + (ΣV)b/Lg    (Eq 23)

The uniformly distributed moment `q` (transport of the net horizontal force to the gravity
axis, per unit length):

    q = [ (ΣH)t − (ΣH)b ] · eb / Lg       (Eq 25)     [kip-in/in]

## 6. Beam end reactions (local effect produces NO end reaction)

    R1 = −(ΣV)T · b / L                   (Eq 20)
    R2 = −(ΣV)T · a / L                   (statics; only a function of the unbalanced load)

## 7. Maximum beam shear and moment — LEFT half of gusset (x1)

    x1(Mmax) = (−R1 − q) / wl             (Eq 28),  valid 0 ≤ x1 ≤ Lg/2
    Vmax     = R1 + 0.5·wl·Lg             (Eq 33)   [shear at mid-gusset]
    Mmax,L   = R1·a' + (R1 + q)·x1 + 0.5·wl·x1²     (Eq 30)

  `d²M/dx1² = wl` (Eq 31): when `wl < 0` (net downward), the extremum in the left half is a
  maximum. When `x1` falls outside `[0, Lg/2]`, the maximum is not interior to the left half —
  evaluate the right half.

## 8. Maximum beam moment — RIGHT half of gusset (x2)

    x2(Mmax) = −(R1 + 0.5·wl·Lg + q) / wr           (Eq 36),  valid 0 ≤ x2 ≤ Lg/2
    Mmax,R   = 0.5·wr·x2² + (R1 + 0.5·wl·Lg + q)·x2
               + [ R1·(a' + 0.5·Lg) + 0.125·wl·Lg² + 0.5·q·Lg ]   (Eq 34/38)
    V(x2)    = R1 + 0.5·wl·Lg + wr·x2                (Eq 40)

The calculator evaluates **both** halves and reports `Mmax = the algebraically larger-magnitude
of Mmax,L and Mmax,R` (paper's explicit instruction, p. 270: "it is good practice to evaluate
moments in both the x1 and x2 regions"). Shear reported is `Vmax` (Eq 33/41).

## 9. Does the chevron effect dominate? (equivalent gusset length, Δ = 0, Eq 48)

    Lg,eq = (MT / (ΣV)T) · [ (b/L − √(b/L)) / ( b/L − (b/L)² ) ]        (Eq 48)

- `Lg < Lg,eq`  → including the chevron effect gives a **larger** moment than a Pab/L analysis
  (Pab/L is **unconservative** for bending; the local effect dominates).
- `Lg > Lg,eq`  → the chevron effect gives a smaller moment (Pab/L is conservative).

When `Δ ≠ 0`, use the full quadratic Eq 47 (transcribed in the build spec appendix; the
calculator restricts the automated dominance flag to the `Δ = 0` closed form and prints a
REVIEW note when `Δ ≠ 0`).

## 10. Reference "divergent" methods (printed for comparison, not for design)

- **Beam-designer (Pab/L / "NVF") method:** treats `(ΣV)T` as a point load at the w.p.,
  ignores the connection. `Mmax = R1·a` (w.p. at midspan → `R1·a`).
- **Connection-designer method** (p. 287): constant shear `V = 2·MT/Lg` over the middle half of
  the gusset, `M = MT/2`. Ignores span and w.p.

The calculator's chevron check reports the symbiotic `Vmax`/`Mmax` as the governing local
demand and prints the two divergent values so the engineer can see the spread.

## 11. Applicability limits / sign notes (enforced or flagged in the calc)

1. `x1` and `x2` roots must lie in `[0, Lg/2]`; if neither half yields an interior extremum the
   maximum occurs at a gusset edge (checked by evaluating `M` at `x1 = 0`, `Lg/2` and `x2 = 0`,
   `Lg/2`). The calculator evaluates edges as well as the interior root.
2. Method is derived for **lateral load only**; combination with gravity/other transverse load on
   the same region is the engineer's responsibility (REVIEW note printed) — p. 268 assumption 1.
3. Top and bottom gusset `Lg` equal and vertical edges aligned when braces frame both sides
   (Eq set assumption). Single-sided (this node) trivially satisfies it.
4. `Vi = 0` balanced case: end reactions vanish, local `Vmax = 0.5·wl·Lg`, `Mmax` from the local
   terms only — the chevron effect is *entirely* what remains and is largest relative to Pab/L.
5. Local effect produces **no** beam end reaction (Eq 20 depends only on `(ΣV)T`); the shear/moment
   it adds is confined to the connection region.

## 12. Wiring into the calculator (how the local demand is used downstream)

- `Vmax` (Eq 33) → the **chevron local web shear** at the gusset ends. Envelope over brace
  Tension and Compression cases (each case sets the signs of `ΣHt`, `ΣVt`). Combined with the
  beam's global shear per §G where coincident (documented).
- `Mmax` (Eq 30/34) → the **chevron local web moment**, combined with the global beam moment in
  the §H1 beam axial+flexure interaction where the gusset region and the max-moment region
  coincide (sign-enveloped). Where they do not coincide, the chevron local moment is checked as
  a stand-alone local demand and the global `Mu` is checked separately (documented assumption).
- The interface horizontal resultant `ΣH_T` is the collector/axial force taken in the bare steel
  section for §H1 (conservative, documented).

## 13. Worked-example reproduction targets (Example Problem 1, p. 276–287)

Frame: `L = 28 ft = 336 in`, w.p. at midspan → `a = b = 168 in`, `b/L = 0.5`.
Part 1 uses **approximate** geometry `Lg,app = L/6 = 56.0 in` (Eq 42),
`eb,app = 0.375·(span ft) = 10.5 in` (Eq 43). `Δ = 0`.

Interface resultants (kips):

| | ΣVt | ΣVb | ΣHt | ΣHb | ΣV_T |
|---|---|---|---|---|---|
| Buckling | 151 | −187 | 285 | −531 | −36.0 |
| Post-buckling | 197.9 | −307.5 | 238.1 | −410.5 | −109.6 |

Paper results to match (± 1%):

| Quantity | Buckling | Post-buckling |
|---|---|---|
| (Ma-a)t [k-in] | 2993 | 2500 |
| (Ma-a)b [k-in] | 5576 | 4310 |
| MT [k-in] | 8569 | 6810 |
| q [k-in/in] | 153 | 122 |
| wl [k/in] | −11.6 | −10.7 |
| R1 [kips] | 18.0 | 54.8 |
| Lg,eq [in] | 197 | 51.5 |
| x1 [in] | 14.8 | 16.5 |
| **Vmax [kips]** | **−307** | **−245** |
| **Mmax [k-in]** | **3780** | **9130** |

Part 2 uses the **actual** connection geometry `Lg = 54.0 in`, `eb = 10.8 in`:

| Quantity | Buckling | Post-buckling |
|---|---|---|
| (Ma-a)t [k-in] | 3078 | 2571 |
| (Ma-a)b [k-in] | 5735 | 4433 |
| MT [k-in] | 8813 | 7004 |
| q [k-in/in] | 163 | 130 |
| wl [k/in] | −12.8 | −11.6 |
| wr [k/in] | 11.4 | 7.58 |
| Lg,eq [in] | 203 | 52.9 |
| Conn-designer V [kips] | 326 | 260 |
| Conn-designer M [k-in] | 4407 | 3502 |

The validator reproduces every row above; the in-calc selftest fixture `C2-CHEV-1` reproduces
the Part-1 post-buckling `Mmax = 9130 k-in` (the governing beam moment) within 1%.
