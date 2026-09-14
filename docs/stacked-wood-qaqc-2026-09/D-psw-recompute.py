# -*- coding: utf-8 -*-
"""Independent first-principles perforated shear wall recompute, SDPWS 2021.

Formulas (verbatim source: AWC SDPWS-2015 w/ Commentary Eq. 4.3-5 / 4.3-6, text
extracted from the PDF; carried forward unchanged as SDPWS 2021 Sec. 4.3.5.6 /
Table 4.3.5.6):

    r   = 1 / (1 + A_o / (h * SUM b_i))                              (4.3-6)
    C_o = [ r / (3 - 2r) ] * ( L_tot / SUM b_i )                     (4.3-5)

    A_o   = SUM over openings of (width * clear height), with the rule
            "Where the opening height is less than h/3, an opening height of
            h/3 shall be used" (SDPWS 4.3.3.5 definition of A_o).
    SUM b_i : SDPWS 2021 4.3.3.4 - segments with h/b > 3.5 excluded entirely;
            segments with h/b > 2 counted as 2*b_i/h * b_i.

Story mechanics (SDPWS 2021 4.3.6.4.4 "sum of forces contributed by each story",
4.3.6.1.3 T and C of perforated shear walls, 4.3.6.4.1.1 v_max,
4.3.6.4.2.1 uniform uplift t = v_max):

    V_k    = SUM_{j >= k} P_j                 (P_j = incremental level force)
    M_k    = SUM_{j >= k} P_j * z_{j,k}       = SUM_{m >= k} V_m * h_m
    v_k    = V_k / (C_o,k * SUM b_i,k)                    [plf]
    T_k    = ( M_k - 0.6 * M_R,k ) / (C_o,k * SUM b_i,k)  [lb], T >= 0
    t_k    = v_k                                          [plf] distributed uplift
    T_end,k(no DL) = v_k * h_k  only for a single story; for stacked walls the
            overturning-moment form above governs.
    M_R,k  = resisting moment of ALL dead load delivered to the wall at and
            above level k, taken about the compression end.  For a load uniform
            over the wall length, M_R = (SUM_{j<=k} w_j) * L^2 / 2.
            Both M_k and 0.6*M_R,k are moments and share the same lever arm
            C_o,k * SUM b_i,k -- this matches WoodWorks Table 10
            (T = (0.7 M_OT - 0.43 M_R)/d) and Excel SW1 column L.
"""
from __future__ import annotations
from dataclasses import dataclass, field


# --------------------------------------------------------------------------
# SDPWS 2021 Table 4.3.5.6 (= 2015 Table 4.3.3.5), for cross-check only
# --------------------------------------------------------------------------
CO_TABLE_PCT = [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00]
CO_TABLE_RATIO = [1 / 3, 1 / 2, 2 / 3, 5 / 6, 1.0]
CO_TABLE = [
    [1.00, 0.69, 0.53, 0.43, 0.36],
    [1.00, 0.71, 0.56, 0.45, 0.38],
    [1.00, 0.74, 0.59, 0.49, 0.42],
    [1.00, 0.77, 0.63, 0.53, 0.45],
    [1.00, 0.80, 0.67, 0.57, 0.50],
    [1.00, 0.83, 0.71, 0.63, 0.56],
    [1.00, 0.87, 0.77, 0.69, 0.63],
    [1.00, 0.91, 0.83, 0.77, 0.71],
    [1.00, 0.95, 0.91, 0.87, 0.83],
    [1.00, 1.00, 1.00, 1.00, 1.00],
]


def sum_bi(segments, h):
    """SDPWS 2021 4.3.3.4 effective SUM b_i.  segments = list of clear lengths b_i."""
    tot = 0.0
    detail = []
    for b in segments:
        ar = h / b if b > 0 else 1e9
        if ar > 3.5:
            detail.append((b, ar, 0.0, "excluded, h/b>3.5"))
            continue
        if ar > 2.0:
            beff = b * (2.0 * b / h)
            detail.append((b, ar, beff, "x 2b/h"))
        else:
            beff = b
            detail.append((b, ar, beff, "full"))
        tot += beff
    return tot, detail


def area_openings(openings, h):
    """A_o with the h/3 minimum clear-opening-height rule.
    openings = list of (width, clear_height)."""
    a = 0.0
    for w, ho in openings:
        a += w * max(ho, h / 3.0)
    return a


def co_sdpws(Ltot, sbi, h, Ao):
    """SDPWS Eq. 4.3-5 / 4.3-6.  Returns (r, C_o)."""
    if sbi <= 0:
        return 0.0, 0.0
    r = 1.0 / (1.0 + Ao / (h * sbi))
    co = (r / (3.0 - 2.0 * r)) * (Ltot / sbi)
    return r, co


def co_calculator(L, Li, ho, h):
    """Verbatim re-implementation of the calculator's calcCo(), for comparison only."""
    if not L or not Li or Li <= 0:
        return 1.0
    alpha = Li / L
    rr = (ho / h) if h > 0 else 0.0
    if rr <= 0 or alpha >= 1.0:
        return 1.0
    if alpha <= 0:
        return 0.001
    return 1.0 / (1.0 + rr * (1.0 - alpha) / alpha)


@dataclass
class Story:
    """One story, index 0 = topmost."""
    name: str
    h: float                 # story (wall) height, ft
    P: float                 # INCREMENTAL level force applied at the top of this story, lb
    L: float                 # total perforated wall length L_tot, ft
    segments: list           # clear pier lengths b_i, ft
    openings: list           # list of (width_ft, clear_height_ft)
    w_DL: float = 0.0        # uniform dead load delivered to the wall, plf
    Vall: float = 0.0        # ASD allowable sheathing capacity, plf
    sill_Vall: float = 0.0   # ASD allowable sill connection capacity, plf
    MR_extra: float = 0.0    # additive resisting moment from non-uniform DL, ft-lb


def analyze(stories):
    n = len(stories)
    # cumulative story shear and overturning moment about the base of each story
    V = [0.0] * n
    M = [0.0] * n
    run_V = 0.0
    run_M = 0.0
    for k in range(n):
        run_V += stories[k].P
        V[k] = run_V
        run_M += run_V * stories[k].h          # M_k = SUM_{m<=k} V_m * h_m
        M[k] = run_M
    out = []
    for k, s in enumerate(stories):
        sbi, seg_detail = sum_bi(s.segments, s.h)
        Ao = area_openings(s.openings, s.h)
        r, Co = co_sdpws(s.L, sbi, s.h, Ao)
        Co_capped = min(Co, 1.0)
        denom = Co_capped * sbi
        v = V[k] / denom if denom > 0 else 0.0
        # dead-load resisting moment: accumulate every story at and above k
        w_cum = sum(stories[j].w_DL for j in range(k + 1))
        MR = w_cum * s.L ** 2 / 2.0 + sum(stories[j].MR_extra for j in range(k + 1))
        T_raw = (M[k] - 0.6 * MR) / denom if denom > 0 else 0.0
        T = max(T_raw, 0.0)
        out.append(dict(
            name=s.name, k=k, h=s.h, P=s.P, V=V[k], M=M[k], w_cum=w_cum,
            L=s.L, sbi=sbi, seg_detail=seg_detail, Ao=Ao, r=r,
            Co=Co, Co_capped=Co_capped, denom=denom,
            v_max=v, t_uplift=v, MR=MR, T_raw=T_raw, T=T,
            sh_dc=(v / s.Vall if s.Vall else None),
            sill_dc=(v / s.sill_Vall if s.sill_Vall else None),
            # calculator-equivalent quantities for side-by-side
            Co_calc=co_calculator(s.L, sum(s.segments), max(o[1] for o in s.openings) if s.openings else 0.0, s.h),
        ))
    return out
