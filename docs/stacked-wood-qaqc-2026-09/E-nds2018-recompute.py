"""
Independent first-principles NDS 2018 ASD recompute for sawn-lumber
headers / jamb packs / king studs / wall studs.

Written from the NDS 2018 text, NOT from the calculator's source.

Section ids used:
  Table 2.3.2      load duration factor C_D
  Sec 3.3.3.6      R_B = sqrt(l_e d / b^2)   (Eq. 3.3-5)
  Sec 3.3.3.7      R_B shall not exceed 50
  Sec 3.3.3.8      Eq. 3.3-6 for C_L; F_bE = 1.20 E'_min / R_B^2
  Sec 3.3.3.8      R_B <= 50
  Sec 3.4.2        f_v = 3V/(2A) for rectangular
  Sec 3.7.1        column stability factor C_P, Eq. 3.7-1
  Sec 3.7.1.4      l_e/d <= 50
  Sec 3.9.2        Eq. 3.9-3 combined bending + axial compression
  Sec 3.10.4       bearing area factor C_b
  Sec 4.3.6        size factor C_F (Table 4A / 4B of the Supplement)
  Sec 4.3.9        repetitive member factor C_r = 1.15
"""
import math

# ---------------------------------------------------------------------------
# Geometry -- S4S dressed dimension lumber (NDS Supplement Table 1B)
# ---------------------------------------------------------------------------
def sect(nom):
    b, d = {'2x4': (1.5, 3.5), '2x6': (1.5, 5.5), '2x8': (1.5, 7.25),
            '2x10': (1.5, 9.25), '2x12': (1.5, 11.25)}[nom]
    return dict(b=b, d=d, A=b * d,
                Sx=b * d * d / 6.0, Ix=b * d ** 3 / 12.0,
                Sy=d * b * b / 6.0, Iy=d * b ** 3 / 12.0)

# ---------------------------------------------------------------------------
# NDS 2018 Supplement reference design values, No. 2 grade, 2"-4" thick
# Table 4A: DFL, SPF (size factors C_F apply)
# Table 4B: Southern Pine (values are already width-specific; C_F = 1.0)
# ---------------------------------------------------------------------------
REF = {
    'DFL': dict(  # Table 4A, Douglas Fir-Larch No.2
        name='Douglas Fir-Larch No.2',
        Fb=900, Ft=575, Fv=180, FcP=625, Fc=1350, E=1.6e6, Emin=580000,
        useCF=True, table='4A'),
    'SPF': dict(  # Table 4A, Spruce-Pine-Fir No.2
        name='Spruce-Pine-Fir No.2',
        Fb=875, Ft=450, Fv=135, FcP=425, Fc=1150, E=1.4e6, Emin=510000,
        useCF=True, table='4A'),
    'SYP': dict(  # Table 4B, Southern Pine No.2 -- width specific
        name='Southern Pine No.2',
        Fb={'2x4': 1500, '2x6': 1250, '2x8': 1200, '2x10': 1050, '2x12': 975},
        Ft={'2x4': 825, '2x6': 725, '2x8': 650, '2x10': 575, '2x12': 550},
        Fv=175, FcP=565,
        Fc={'2x4': 1650, '2x6': 1600, '2x8': 1550, '2x10': 1500, '2x12': 1450},
        E=1.6e6, Emin=580000, useCF=False, table='4B'),
}
# Table 4A size factors (No.2 grade)
CF_FB_4A = {'2x4': 1.5, '2x6': 1.3, '2x8': 1.2, '2x10': 1.1, '2x12': 1.0}
CF_FC_4A = {'2x4': 1.15, '2x6': 1.1, '2x8': 1.05, '2x10': 1.0, '2x12': 1.0}


def Fb_ref(sp, sz):
    v = REF[sp]['Fb']
    return v[sz] if isinstance(v, dict) else v


def Fc_ref(sp, sz):
    v = REF[sp]['Fc']
    return v[sz] if isinstance(v, dict) else v


def CF_Fb(sp, sz):
    return CF_FB_4A[sz] if REF[sp]['useCF'] else 1.0


def CF_Fc(sp, sz):
    return CF_FC_4A[sz] if REF[sp]['useCF'] else 1.0


# ---------------------------------------------------------------------------
# Table 2.3.2 load duration factors
# ---------------------------------------------------------------------------
CD = dict(permanent=0.9, occupancy=1.0, snow=1.15, construction=1.25,
          wind=1.6, impact=2.0)


# ---------------------------------------------------------------------------
# Sec 3.3.3 -- beam stability factor C_L
# ---------------------------------------------------------------------------
def le_table333(lu, d, case='uniform'):
    """NDS 2018 Table 3.3.3 (with Commentary PDF p.30 / printed p.16).

    IMPORTANT: the NAMED rows have only two branches (lu/d < 7 and lu/d >= 7).
    The three-branch form with 1.84 lu above lu/d = 14.3 is **footnote 1**, which
    applies ONLY to "loading conditions not specified in Table 3.3.3".  A single
    span under a uniformly distributed load IS specified, so 1.63 lu + 3d governs
    all the way up.  (Confirmed by AWC Example E1.2a, which has lu/d = 15.7 > 14.3
    and still uses the named concentrated-load row, 1.37 lu + 3d.)
    """
    r = lu / d
    if case == 'uniform':                       # Single Span Beam, uniformly distributed
        if r < 7:
            return 2.06 * lu, 'lu/d < 7 -> le = 2.06 lu  (Table 3.3.3, single span, UDL)'
        return 1.63 * lu + 3.0 * d, 'lu/d >= 7 -> le = 1.63 lu + 3d  (Table 3.3.3, single span, UDL)'
    if case == 'center':                        # concentrated load at center, no interm. support
        if r < 7:
            return 1.80 * lu, 'lu/d < 7 -> le = 1.80 lu  (Table 3.3.3)'
        return 1.37 * lu + 3.0 * d, 'lu/d >= 7 -> le = 1.37 lu + 3d  (Table 3.3.3)'
    if case == 'unlisted':                      # Table 3.3.3 footnote 1
        if r < 7:
            return 2.06 * lu, 'lu/d < 7 -> le = 2.06 lu  (Table 3.3.3 fn.1)'
        if r <= 14.3:
            return 1.63 * lu + 3.0 * d, '7 <= lu/d <= 14.3 -> le = 1.63 lu + 3d  (fn.1)'
        return 1.84 * lu, 'lu/d > 14.3 -> le = 1.84 lu  (Table 3.3.3 fn.1)'
    raise ValueError(case)


def calc_CL(Fb_star, Emin_p, lu, d, b, case='uniform'):
    """Eq. 3.3-6 (Sec 3.3.3.8).  RB_ok flags Sec 3.3.3.7: "The slenderness ratio
    for bending members, R_B, shall not exceed 50."  NOT clamped."""
    le, branch = le_table333(lu, d, case)
    RB = math.sqrt(le * d / (b * b))
    FbE = 1.20 * Emin_p / (RB * RB)
    ratio = FbE / Fb_star
    A = (1.0 + ratio) / 1.9
    CL = A - math.sqrt(A * A - ratio / 0.95)
    return dict(le=le, branch=branch, RB=RB, RB_ok=(RB <= 50.0),
                FbE=FbE, Fb_star=Fb_star, ratio=ratio, CL=min(CL, 1.0))


# ---------------------------------------------------------------------------
# Sec 3.7.1 -- column stability factor C_P
# ---------------------------------------------------------------------------
def calc_CP(Fc_star, Emin_p, le, d, c=0.8, KcE=0.822):
    """Eq. 3.7-1.  slend_ok flags Sec 3.7.1.4 (l_e/d <= 50).  NOT clamped."""
    slend = le / d
    FcE = KcE * Emin_p / (slend * slend)
    ratio = FcE / Fc_star
    A = (1.0 + ratio) / (2.0 * c)
    CP = A - math.sqrt(A * A - ratio / c)
    return dict(slend=slend, slend_ok=(slend <= 50.0), FcE=FcE,
                Fc_star=Fc_star, ratio=ratio, CP=min(CP, 1.0))


# ---------------------------------------------------------------------------
# Sec 3.10.4 -- bearing area factor
# ---------------------------------------------------------------------------
def calc_Cb(lb_in, at_member_end=True):
    """NDS 2018 Sec 3.10.4, verbatim: reference F_c-perp values "apply to bearings
    of ANY LENGTH AT THE ENDS OF A MEMBER, and to all bearings 6 in or more in
    length at any other location.  For bearings less than 6 in in length and NOT
    NEARER THAN 3 in TO THE END of a member" F_c-perp may be multiplied by
    C_b = (l_b + 0.375)/l_b   (Eq. 3.10-2).

    A header bearing on its jamb studs is a bearing AT THE END of the member, so
    C_b = 1.0.  (AWC Example E1.2a says the same for a beam on a 2x4 top plate:
    "That increase was not used in this example.")
    """
    if at_member_end or lb_in >= 6.0:
        return 1.0
    return (lb_in + 0.375) / lb_in


# ---------------------------------------------------------------------------
# ASCE 7-16 Sec 2.4.1 ASD combinations (gravity subset) with matching C_D
# Roof live (Lr) and snow (S) are alternatives -- never additive.
# ---------------------------------------------------------------------------
def gravity_combos(D, L, Lr, S):
    out = [('D', D, CD['permanent']),
           ('D+L', D + L, CD['occupancy'])]
    if Lr:
        out.append(('D+Lr', D + Lr, CD['construction']))
        out.append(('D+0.75L+0.75Lr', D + 0.75 * L + 0.75 * Lr, CD['construction']))
    if S:
        out.append(('D+S', D + S, CD['snow']))
        out.append(('D+0.75L+0.75S', D + 0.75 * L + 0.75 * S, CD['snow']))
    return out


# ===========================================================================
# HEADER -- uniformly loaded simple span, n plies of one size
# ===========================================================================
def header(sz, n_plies, span_ft, D, L, Lr, S, sp='DFL',
           n_jambs=1, Cr=1.0, lu_ft=None, defl_live_lim=360.0,
           defl_total_lim=240.0):
    g = sect(sz)
    b_eff, d = n_plies * g['b'], g['d']
    A_eff, S_eff, I_eff = n_plies * g['A'], n_plies * g['Sx'], n_plies * g['Ix']
    L_in = span_ft * 12.0
    lu_in = L_in if lu_ft is None else lu_ft * 12.0
    R = REF[sp]
    Fb0, Fv0, FcP0 = Fb_ref(sp, sz), R['Fv'], R['FcP']
    Emin, E = R['Emin'], R['E']
    cf_b = CF_Fb(sp, sz)

    best = None
    for tag, w, cd in gravity_combos(D, L, Lr, S):
        if w <= 0:
            continue
        M_in = w * span_ft * span_ft / 8.0 * 12.0
        V = w * span_ft / 2.0
        fb = M_in / S_eff
        fv = 1.5 * V / A_eff
        Fb_star = Fb0 * cd * cf_b * Cr            # C_M=C_t=C_fu=C_i=1.0
        cl = calc_CL(Fb_star, Emin, lu_in, d, b_eff)
        Fb_p = Fb_star * cl['CL']
        Fv_p = Fv0 * cd
        # bearing: header sits on n_jambs studs, contact = b_eff x (n_jambs*1.5)
        lb = n_jambs * 1.5
        A_bear = b_eff * lb
        Cb = calc_Cb(lb, at_member_end=True)   # header end bearing -> C_b = 1.0
        FcP_p = FcP0 * Cb                          # F_cperp not adjusted by C_D
        fcp = V / A_bear
        rec = dict(combo=tag, w=w, CD=cd, M_in=M_in, V=V, fb=fb, fv=fv,
                   fcp=fcp, cl=cl, Fb_p=Fb_p, Fv_p=Fv_p, FcP_p=FcP_p, Cb=Cb,
                   lb=lb, dc_b=fb / Fb_p, dc_v=fv / Fv_p, dc_p=fcp / FcP_p)
        rec['gov'] = max(rec['dc_b'], rec['dc_v'], rec['dc_p'])
        if best is None or rec['gov'] > best['gov']:
            best = rec

    def defl(w_plf):
        w_in = w_plf / 12.0
        return 5.0 * w_in * L_in ** 4 / (384.0 * E * I_eff)

    w_live = max(L + Lr, L + S)                    # Lr and S not additive
    d_live = defl(w_live)
    d_tot = defl(D + w_live)
    best.update(I_eff=I_eff, S_eff=S_eff, A_eff=A_eff, b_eff=b_eff, d=d,
                span_in=L_in, lu_in=lu_in, sz=sz, n_plies=n_plies, sp=sp,
                defl_live=d_live, defl_live_allow=L_in / defl_live_lim,
                defl_total=d_tot, defl_total_allow=L_in / defl_total_lim,
                dc_defl_live=d_live / (L_in / defl_live_lim),
                dc_defl_total=d_tot / (L_in / defl_total_lim))
    best['gov_all'] = max(best['gov'], best['dc_defl_live'], best['dc_defl_total'])
    best['pass'] = best['gov_all'] <= 1.0
    return best


# ===========================================================================
# JAMB PACK -- n x 2x, concentric axial
# ===========================================================================
def jamb_pack(sz, n, P_D, P_L, P_Lr, P_S, story_ft, sp='DFL',
              weak_brace_in=48.0, Ke=1.0):
    g = sect(sz)
    R = REF[sp]
    Fc0, Emin = Fc_ref(sp, sz), R['Emin']
    cf_c = CF_Fc(sp, sz)
    A_tot = n * g['A']
    H_in = story_ft * 12.0

    best = None
    for tag, P, cd in gravity_combos(P_D, P_L, P_Lr, P_S):
        if P <= 0:
            continue
        Fc_star = Fc0 * cd * cf_c
        # weak axis (buckling about the 1.5 in dimension)
        weak_braced = calc_CP(Fc_star, Emin, Ke * weak_brace_in, g['b'])
        weak_unbr = calc_CP(Fc_star, Emin, Ke * H_in, g['b'])
        strong = calc_CP(Fc_star, Emin, Ke * H_in, g['d'])
        gov_cp = min(weak_braced['CP'], strong['CP'])
        which = 'weak(braced)' if weak_braced['CP'] <= strong['CP'] else 'strong'
        Fc_p = Fc_star * gov_cp
        fc = P / A_tot
        rec = dict(combo=tag, P=P, CD=cd, fc=fc, Fc_star=Fc_star, Fc_p=Fc_p,
                   CP=gov_cp, axis=which, weak_braced=weak_braced,
                   weak_unbraced=weak_unbr, strong=strong, dc=fc / Fc_p)
        if best is None or rec['dc'] > best['dc']:
            best = rec
    best.update(n=n, sz=sz, A_tot=A_tot, sp=sp, story_ft=story_ft,
                brace_in=weak_brace_in, pass_=best['dc'] <= 1.0)
    return best


# ===========================================================================
# KING STUD / WALL STUD -- axial + out-of-plane uniform wind, Eq. 3.9-3
# ===========================================================================
def stud_beamcolumn(sz, trib_ft, p_strength_psf, story_ft,
                    P_D, P_L, P_Lr, P_S, sp='DFL', Cr=1.0,
                    weak_brace_in=0.0, Ke=1.0, p_is_asd=False,
                    defl_lim=240.0):
    """
    trib_ft        tributary width of wall for wind (ft)
    p_strength_psf ASCE 7-16 Ch.30 strength-level C&C pressure
    weak_brace_in  0 = sheathing braces the weak axis continuously
    Axial P_* are TOTAL force on this member (lb) for each load source.
    """
    g = sect(sz)
    R = REF[sp]
    Fb0, Fc0, Fv0 = Fb_ref(sp, sz), Fc_ref(sp, sz), R['Fv']
    Emin, E = R['Emin'], R['E']
    cf_b, cf_c = CF_Fb(sp, sz), CF_Fc(sp, sz)
    H_in = story_ft * 12.0
    w_service = (p_strength_psf if p_is_asd else p_strength_psf) * trib_ft

    def cp_gov(Fc_star):
        strong = calc_CP(Fc_star, Emin, Ke * H_in, g['d'])
        if weak_brace_in <= 0:
            return strong, 'strong (weak axis sheathed)', None
        weak = calc_CP(Fc_star, Emin, Ke * weak_brace_in, g['b'])
        return (weak, 'weak', strong) if weak['CP'] < strong['CP'] else (strong, 'strong', weak)

    combos = []
    # gravity-only
    for tag, P, cd in gravity_combos(P_D, P_L, P_Lr, P_S):
        combos.append((tag, P, 0.0, cd))
    # D + 0.6W   (0.6 converts strength-level W to ASD)
    wf = 1.0 if p_is_asd else 0.6
    combos.append(('D+0.6W', P_D, wf * w_service, CD['wind']))
    # D + 0.75L + 0.75(0.6W) + 0.75(Lr or S)
    for tag2, alt in (('Lr', P_Lr), ('S', P_S)):
        if alt:
            combos.append(('D+0.75L+0.75(0.6W)+0.75' + tag2,
                           P_D + 0.75 * P_L + 0.75 * alt,
                           0.75 * wf * w_service, CD['wind']))
    if not P_Lr and not P_S:
        combos.append(('D+0.75L+0.75(0.6W)', P_D + 0.75 * P_L,
                       0.75 * wf * w_service, CD['wind']))
    # 0.6D + 0.6W  (uplift/overturning; bending still applies)
    combos.append(('0.6D+0.6W', 0.6 * P_D, wf * w_service, CD['wind']))

    best = None
    for tag, P, w_plf, cd in combos:
        Fc_star = Fc0 * cd * cf_c
        cp, axis, other = cp_gov(Fc_star)
        Fc_p = Fc_star * cp['CP']
        Fb_star = Fb0 * cd * cf_b * Cr
        Fb_p = Fb_star * 1.0                      # C_L = 1.0, comp. edge sheathed
        Fv_p = Fv0 * cd
        M_in = w_plf * story_ft * story_ft / 8.0 * 12.0
        V = w_plf * story_ft / 2.0
        fc = P / g['A']
        fb = M_in / g['Sx']
        fv = 1.5 * V / g['A']
        # Eq. 3.9-3, F_cE1 about the axis of bending (strong axis)
        FcE1 = 0.822 * Emin / (H_in / g['d']) ** 2
        t1 = (fc / Fc_p) ** 2 if Fc_p > 0 else 0.0
        den = Fb_p * (1.0 - fc / FcE1)
        t2 = fb / den if (den > 0 and fb > 0) else 0.0
        rec = dict(combo=tag, P=P, w=w_plf, CD=cd, fc=fc, fb=fb, fv=fv,
                   Fc_p=Fc_p, Fb_p=Fb_p, Fv_p=Fv_p, FcE1=FcE1, CP=cp['CP'],
                   cp=cp, axis=axis, M_in=M_in, V=V, term1=t1, term2=t2,
                   DC=t1 + t2, dc_v=fv / Fv_p if Fv_p else 0.0)
        if best is None or rec['DC'] > best['DC']:
            best = rec
    # service wind deflection (full nominal W is not used; 0.6W is the ASD case)
    w_in = (wf * w_service) / 12.0
    d_w = 5.0 * w_in * H_in ** 4 / (384.0 * E * g['Ix'])
    best.update(sz=sz, sp=sp, trib_ft=trib_ft, story_ft=story_ft,
                w_service=w_service, Sx=g['Sx'], A=g['A'], Ix=g['Ix'],
                defl=d_w, defl_allow=H_in / defl_lim,
                dc_defl=d_w / (H_in / defl_lim), Cr=Cr)
    best['pass'] = best['DC'] <= 1.0 and best['dc_v'] <= 1.0
    return best
