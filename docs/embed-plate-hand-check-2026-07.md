# Embed Plate Beam Bearing Calculator — Independent Hand Check

Date: July 2026  
Calculator: `public/Calcs/embed_plate_beam_bearing_calculator.html`  
Acceptance tolerance: ±0.5%  
Status: independent verification of the EOR-directed DR-01 methodology; this document does not revise that methodology.

## Methodology and verification configuration

The calculator models four horizontal anchors in a fixed 2×2 group. Each anchor's projected tension area starts with a circle of radius `Lb`. In accordance with DR-01, one half-lens (one circular segment) is deducted for each neighbor: in-row at chord distance `c = Sx/2`, cross-row at `c = d/2`, and diagonal at `c = g/2`, where `g = √(Sx²+d²)`. A free-edge segment is also deducted when `lbe < Lb`. The plate model is the decreed bolt-tension model: `Trow = 2Tbolt`, `Mpl = 0.5 Trow a`, using UNC threaded areas internally. Both load cases use `k = 3/4` on the demand side.

The numerical defaults are `f'm=2.5 ksi`, anchor `fy=36 ksi`, input/effective `Fu=58 ksi`, plate `Fy=36 ksi`, `φ=0.75 in`, `Lb=6 in`, `Sx=5 in`, `Wp=8 in`, `Hp=12 in`, `et=eb=1.5 in`, `e=2 in`, `ac=1 in`, wall `b=7.625 in`, `lbe,shear=12 in`, and plate `t=0.5 in`; Case 1 is `V1=15 kip, P1=0`, and Case 2 is `V2=6 kip, P2=0`. The two default checkbox states are unchecked in the HTML, but this EOR-directed verification checks both one-third-increase boxes so that `k1=k2=0.75`, as required by DR-01. All “calc value” entries below are the calculator values for that verification configuration.

Circular-segment function used independently throughout:

`Aseg(R,c) = R² acos(c/R) − c√(R²−c²)` for `c<R`, otherwise zero.

## Geometry, threaded area, and projected areas

| Check | Provision | Hand substitution | Hand result | Calc value | Result | Code |
|---|---|---|---:|---:|---|---|
| Row spacing | Geometry | `d=Hp−et−eb=12−1.5−1.5` | 9.000 in | 9.00 in | Agree | lines 678–679 |
| Diagonal spacing | DR-01 | `g=√(5²+9²)` | 10.2956 in | 10.30 in | Agree | line 723 |
| UNC threaded area | TMS 402-22 Eq. 6-7 | `nt=10`; `Ab=(π/4)(0.75−0.9743/10)²` | 0.334460 in² | 0.3345 in² | Agree | lines 655–656, 681–683 |
| Minimum embedment | TMS §6.3.6 | `Lb,min=max(4×0.75,2)=3.00`; `D/C=3/6` | 3.000 in; 0.500 | 3.00 in; 0.500 | Agree | lines 753–754, 808–813 |
| In-row half-lens | TMS §6.3.2; DR-01 | `Aseg(6,5/2)=36acos(2.5/6)−2.5√(36−2.5²)` | 27.4409 in² | 27.44 in² | Agree | lines 720–725 |
| Cross-row half-lens | TMS §6.3.2; DR-01 | `Aseg(6,9/2)=36acos(4.5/6)−4.5√(36−4.5²)` | 8.15961 in² | 8.16 in² | Agree | lines 720–726 |
| Diagonal half-lens | TMS §6.3.2; DR-01 | `Aseg(6,10.2956/2)` | 3.55512 in² | 3.56 in² | Agree | lines 723, 726 |
| Free-edge tension deduction | TMS §6.3.2 | `lbe=12 ≥ Lb=6`, therefore `Aseg(6,12)=0` | 0 in² | 0.00 in² | Agree | line 727 |
| Projected tension area per anchor | TMS Eq. 6-5; DR-01 | `Apt=π(6²)−27.4409−8.15961−3.55512−0` | 73.9417 in² | 73.94 in² | Agree | lines 728–730 |
| Shear overlap deduction | TMS §6.3.3 | `0.5Aseg(12,2.5)=0.5[144acos(2.5/12)−2.5√(144−2.5²)]` | 83.3158 in² | 83.32 in² | Agree | lines 749–751 |
| Projected shear area | TMS Eq. 6-6 | `Apv=π(12²)/2−83.3158` | 142.8789 in² | 142.88 in² | Agree | lines 749–751 |

## Anchor capacities

| Check | Provision | Hand substitution | Hand result | Calc value | Result | Code |
|---|---|---|---:|---:|---|---|
| Effective anchor strength | TMS §6.3.8 | `Fu,eff=min(58,1.9×36,125)` | 58.000 ksi | 58.0 ksi | Agree | lines 647–652 |
| Masonry tension breakout | TMS §8.1.4.3.1 | `Ba,mas=1.25(73.9417)√2500/1000` | 4.62136 kip | 4.621 kip | Agree | line 757 |
| Anchor steel tension | TMS §8.1.4.3.1 | `Ba,steel=0.5(0.334460)(58)` | 9.69934 kip | 9.699 kip | Agree | line 758 |
| Governing tension | TMS §8.1.4.3.1 | `Ba=min(4.62136,9.69934)` | 4.62136 kip | 4.621 kip | Agree | line 759 |
| Masonry shear breakout | TMS Eq. 8-4 | `Bv1=1.25(142.8789)√2500/1000` | 8.92993 kip | 8.930 kip | Agree | line 762 |
| Masonry crushing | TMS Eq. 8-5 | `Bv2=580(0.334460×2500)^0.25/1000` | 3.11888 kip | 3.119 kip | Agree | line 763 |
| Pryout | TMS Eq. 8-6 | `Bv3=2.5(73.9417)√2500/1000` | 9.24272 kip | 9.243 kip | Agree | line 764 |
| Anchor steel shear | TMS §8.1.4.3.2 | `Bv4=0.25(0.334460)(58)` | 4.84967 kip | 4.850 kip | Agree | line 765 |
| Governing shear | TMS §8.1.4.3.2 | `Bv=min(8.92993,3.11888,9.24272,4.84967)` | 3.11888 kip, crushing | 3.119 kip, crushing | Agree | lines 766–771 |

## Case 1 — gravity/down, top row tension

`k1=0.75`, bottom-edge bearing, `y1=d+eb−ac/2=9+1.5−0.5=10.0 in`, and plate lever arm `a1=Hp/2−et=6−1.5=4.5 in`.

| Check | Provision | Hand substitution | Hand result | Calc value | Result | Code |
|---|---|---|---:|---:|---|---|
| Couple moment | Statics | `M=V1e=15×2` | 30.000 kip-in | 30.00 kip-in | Agree | lines 776–783 |
| Couple force | Statics | `Tc=M/y1=30/10` | 3.000 kip | 3.000 kip | Agree | lines 776–783 |
| Top-row per-bolt tension | Statics | `T=P1/4+Tc/2=0+3/2` | 1.500 kip | 1.500 kip | Agree | lines 779–780 |
| Other-row per-bolt tension | Statics | `P1/4=0/4` | 0 kip | 0 kip | Agree | line 780 |
| Per-anchor shear | Statics | `v=V1/4=15/4` | 3.750 kip | 3.750 kip | Agree | line 781 |
| Tension demand | DR-01 `k=3/4` | `kT=0.75×1.5` | 1.125 kip; D/C 0.243435 | 1.125 kip; 0.243 | Agree | lines 871–883 |
| Shear demand | DR-01 `k=3/4` | `kv=0.75×3.75` | 2.8125 kip; D/C 0.901765 | 2.813 kip; 0.902 | Agree | lines 899–907 |
| Tension/shear interaction | TMS Eq. 8-8 | `(1.125/4.62136)^(5/3)+(2.8125/3.11888)^(5/3)` | 0.936606 | 0.937 | Agree | lines 910–918 |
| Wall bearing | TMS §8.1.6 / §4.4.4 | `C=3`; `fbr=0.75×3/(8×1)=0.28125`; `Fbr=0.33×2.5` | 0.28125 ksi vs 0.825 ksi; D/C 0.340909 | 0.281 ksi vs 0.825 ksi; 0.341 | Agree | lines 933–944 |
| Plate row force | DR-01 | `Trow=2T=2×1.5` | 3.000 kip | 3.000 kip | Agree | lines 946–952 |
| Plate moment | DR-01 bolt-tension model | `Mpl=0.5Trowa=0.5×3×4.5`; `kMpl=0.75×6.75` | 6.750 raw; 5.0625 kip-in demand | 6.750; 5.063 kip-in | Agree | lines 946–953 |
| Plate section modulus | AISC F11 model | `S=Wpt²/6=8(0.5²)/6` | 0.333333 in³ | 0.3333 in³ | Agree | line 954 |
| Plate bending | AISC 360-22 F11 | `fb=5.0625/0.333333`; `Fb=0.60×36` | 15.1875 ksi vs 21.6 ksi; D/C 0.703125 | 15.19 ksi vs 21.60 ksi; 0.703 | Agree | lines 952–957 |
| Plate shear | AISC 360-22 G | `Vsh=max(15,3)=15`; `fv=0.75×15/(8×0.5)`; `Fv=0.40×36` | 2.8125 ksi vs 14.4 ksi; D/C 0.195313 | 2.813 ksi vs 14.40 ksi; 0.195 | Agree | lines 958–962 |

## Case 2 — reversal, bottom row tension

`k2=0.75`, top-edge bearing, `y2=d+et−ac/2=9+1.5−0.5=10.0 in`, and `a2=Hp/2−eb=4.5 in`.

| Check | Provision | Hand substitution | Hand result | Calc value | Result | Code |
|---|---|---|---:|---:|---|---|
| Couple moment | Statics | `M=V2e=6×2` | 12.000 kip-in | 12.00 kip-in | Agree | lines 776–786 |
| Couple force | Statics | `Tc=12/10` | 1.200 kip | 1.200 kip | Agree | lines 776–786 |
| Bottom-row per-bolt tension | Statics | `T=P2/4+Tc/2=0+1.2/2` | 0.600 kip | 0.600 kip | Agree | lines 779–786 |
| Other-row per-bolt tension | Statics | `P2/4=0` | 0 kip | 0 kip | Agree | line 780 |
| Per-anchor shear | Statics | `v=V2/4=6/4` | 1.500 kip | 1.500 kip | Agree | line 781 |
| Tension demand | DR-01 `k=3/4` | `kT=0.75×0.6` | 0.450 kip; D/C 0.097374 | 0.450 kip; 0.097 | Agree | lines 871–883 |
| Shear demand | DR-01 `k=3/4` | `kv=0.75×1.5` | 1.125 kip; D/C 0.360706 | 1.125 kip; 0.361 | Agree | lines 899–907 |
| Tension/shear interaction | TMS Eq. 8-8 | `(0.45/4.62136)^(5/3)+(1.125/3.11888)^(5/3)` | 0.203387 | 0.203 | Agree | lines 910–918 |
| Wall bearing | TMS §8.1.6 / §4.4.4 | `C=1.2`; `fbr=0.75×1.2/(8×1)`; `Fbr=0.825` | 0.1125 ksi; D/C 0.136364 | 0.113 ksi; 0.136 | Agree | lines 933–944 |
| Plate row force | DR-01 | `Trow=2×0.6` | 1.200 kip | 1.200 kip | Agree | lines 946–952 |
| Plate moment | DR-01 bolt-tension model | `Mpl=0.5×1.2×4.5`; `kMpl=0.75×2.7` | 2.700 raw; 2.025 kip-in demand | 2.700; 2.025 kip-in | Agree | lines 946–953 |
| Plate bending | AISC 360-22 F11 | `fb=2.025/0.333333`; `Fb=21.6` | 6.075 ksi; D/C 0.281250 | 6.08 ksi; 0.281 | Agree | lines 954–957 |
| Plate shear | AISC 360-22 G | `Vsh=max(6,1.2)=6`; `fv=0.75×6/(8×0.5)`; `Fv=14.4` | 1.125 ksi; D/C 0.078125 | 1.125 ksi; 0.078 | Agree | lines 958–962 |

## Verdict

Every default-input calculation required by the calculator—including geometry, UNC area, all projected-area deductions, embedment, both anchor tension modes, all four anchor shear modes, both load-case statics, tension/shear interaction, masonry bearing, F11 plate bending, and plate shear—agrees with the independently evaluated hand result within ±0.5% when `k=3/4` is applied to both cases as directed.

No implementation defect was found in the checked calculation path. No DR-01 methodology conflict was identified. There are therefore no items marked **ESCALATE TO EOR**.

One configuration note is material to reproducibility: the HTML defaults leave `inc1` and `inc2` unchecked (`k=1.0`), while this EOR-directed check requires `k=0.75` per case. The central fixture should explicitly set both checkboxes true so its rendered values match this hand check.
