# Wave-1 as-built API (parapet steps) — for WP-3 / WP-4

## RD engine v2 (`public/Calcs/engines/rect-diaphragm.js`)
- `RD.calcDir(V, L_along, B_perp, swRows, dirLabel, opts?)`; `opts.steps=[{label,start,width,F}]` (F kips, same sense as V). Returns all v1 keys (`label,V,L_along,B_perp,w,sws,reactions,unitShears,M_max,M_note,Vmax_beam,chord_T,v_dia`) — V is TOTAL incl. steps; w = V_udl/L; M_max = max|M|. New: `V_udl, V_steps, model ('single-line'|'two-line-statics'|'simple-spans'), steps:[{label,index,start,end,width,F,w_klf,x,segments}], moment:{about:0, rows:[{item,kind:'load'|'reaction',F,x,Fx}], sumF,sumM,sumR,sumRx,checkF,checkM,ok,note?}, diagram (null single-line | {points:[{x,V_left,V_right,M,vZero?}],Vmax,Mmax,x_Mmax,M_pos,M_neg,vZeros}), spans (3+ lines: [{k,a,b,s,Ra,Rb,segments:[{span,item,kind,p,q,F,c,Ra,Rb,overhang}]}])`.
- `RD.stepForces(parapet,B,D)` → `{qp_psf,GCpn_ww,GCpn_lw,h_typ_ft,h_max_ft,asdFactor,steps:[{index,label,face,dir,origin,start_ft,width_ft,end_ft,h_ft,dh_ft,x_ft,faceLen_ft,F_ww_k,F_lw_k,active}],X:[active],Y:[active],anyActive,fatal:[]}`; F = GC·qp·Δh·width·asdFactor/1000 (kips).
- `RD.analyze(o)`: `o.parapet = {qp_psf, GCpn_ww:1.5, GCpn_lw:1.0, h_typ_ft, h_max_ft, commonBase:bool, roofFlat:bool|null, asdFactor?, steps:[{label,face:'N'|'S'|'E'|'W',start_ft,width_ft,h_ft,active?}]}`. N/S faces → Wind-Y (start from W corner); E/W → Wind-X (start from S corner). Returns `{wx,wy,sx,sy,parapet?}` or GLOBAL `{fatal:[messages]}` (no wx/wy/sx/sy).
  - Unstepped direction: single calcDir shape, no `cases`.
  - Stepped direction: `{label,dir,stepped:true,V_udl,L_along,B_perp,w,sws,steps,cases,envelope}` — NO top-level reactions/V/M_max. `cases` = [fromN,fromS] (Y) or [fromW,fromE] (X), each a full calcDir result + `id,windward,leeward,V_total,Vmax,Mmax`; case steps carry `face`, `GC_role`. `envelope = {reactions:[{label,loc,len,abs,sign,value,governing_cases}], Vmax, Mmax, chord_T, v_dia, V_total}` — last five each `{value, cases:[ids]}` (ties list all).
  - Fatal: active step with <2 lines in its direction; h_step > h_max; commonBase !== true; roofFlat === false; step past face; qp ≤ 0; missing h_max; h_typ > h_max; bad face. Blank h_typ = h_max. Step active iff Δh>0, width>0, active!==false.
  - ASD: `asdFactor` 0.6 for display only on ASD-entered pages; export/handoff: baseline converted to strength, asdFactor 1.
  - Seismic runs never get steps. `ENGINE.version = 2`.

## MWFRS payload to `LH.fromMwfrs` (`asce716_mwfrs_calculator.html` buildLateralPayload)
Adds `hpTyp` (effective; 0 when hp = 0 → geometry.hp_typ_ft), `roofType ('flat'|'gablehip'|'monoslope'|'mansard')`, `theta`, and
`parapet: {hp_max_ft, hp_typ_ft, z_p_ft, qp_psf, GCpn_ww:1.5, GCpn_lw:1.0, pp_ww_psf, pp_lw_psf, pp_net_psf, w_typ_plf, roofType, roof_theta_deg, roofFlat}` or null when hp = 0. Full precision. Typical parapet force already inside level-0 F_wind_* / F_parapet_*. Page has a fallback that adds `parapet`/`geometry.hp_typ_ft` to the record if fromMwfrs omits them — WP-4 should make fromMwfrs carry them (then the fallback is inert).

## Wave-2 shared contract (fixed by orchestrator — both WP-3 and WP-4 code to this)
Diaphragm page field ids (Tier-A, captured in the snapshot; none start with `#sw`):
- `#ppQp` q_p psf (strength, from MWFRS; source-owned, read-only unless `#ppUnlock` checked)
- `#ppHmax` h_p,max ft (source-owned), `#ppHtyp` h_p,typ ft (source-owned)
- `#ppUnlock` checkbox (override source-owned values; an override differing from the imported record shows a results warning)
- `#ppRoof` hidden/select: 'flat' | 'sloped' | '' (unknown/hand-entered) — from record `parapet.roofFlat`
- `#ppCommonBase` checkbox "All parapet bases are at roof datum h (parapet top = h + height)"
- `#stepsAtLevel` select 'on'|'off' (auto 'on' only for the roof level on MWFRS level switch)
- `#stepJSON` hidden textarea: JSON array `[{label, face, start_ft, width_ft, h_ft}]` — authoritative; row inputs carry `data-are-ignore`.
Mapping to `RD.analyze` parapet (both page `calculate()` and `LH.levelFromDiaphragmState` build it identically — put a shared builder `LH.parapetFromFields(f)` in lateral-handoff.js that the page calls; WP-4 writes it, WP-3 calls it): `{qp_psf:+#ppQp, GCpn_ww:1.5, GCpn_lw:1.0, h_typ_ft:+#ppHtyp, h_max_ft:+#ppHmax, commonBase: #ppCommonBase checked, roofFlat: #ppRoof==='flat' ? true : #ppRoof==='sloped' ? false : null, steps: #stepsAtLevel==='on' ? JSON.parse(#stepJSON||'[]') : []}`; returns null when there are no steps (so unstepped pages are unchanged). Snapshot field value for checkboxes: follow how are-utils-v2 captures checkboxes (check it) — LH must read the same representation.
Absent fields (old files) → no steps.
Level record (from `levelFromDiaphragmState`) for a stepped direction adds: `F_parapet_step_x/y_strength_lb`, `cases_x/y: [{id, total_lb, reactions:{wallId: signed_lb}}]`, per-wall envelope in `walls.X/Y[i]`: `R_wind_strength_lb` = envelope magnitude (≥0), `sign_wind`, `case_wind` (governing ids joined), plus `sign_seis`; level `parapet: {qp_psf, h_typ_ft, h_max_ft, steps:[...with dh_ft, F_ww_lb, F_lw_lb]}`. `F_wind_x/y_strength_lb` = max case total. Unstepped levels: unchanged shape and values (legacy `sign` kept).
