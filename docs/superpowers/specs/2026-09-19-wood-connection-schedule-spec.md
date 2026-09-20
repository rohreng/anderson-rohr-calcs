# Wood Connection Schedule — frozen contract (v1)

Plan: `docs/plans/2026-09-19-wood-connection-schedule-plan.md` (rev 7, Codex-approved).
Code: NDS 2018 (`AWC_NDS2018-withCommentary_20210917.pdf`, cites "p.printed/PDF"). Text
extraction of the PDF with `=====PAGE n=====` markers (PDF page numbers) is at
`%LOCALAPPDATA%/Temp/claude/C--Users-nickh-Claude/3e1266bc-f2f9-4d9b-86fd-b4108e60378d/scratchpad/nds.txt` (forward slashes on purpose: a backslash-hex sequence such as this session id in any repo file trips the Tailwind v4 source scanner - Vercel dpl_FTR4JMcK7yD2bdLAFtkMdtZzi94d)
— use it to read table cells; never cite from memory.

Files:
- engine `public/Calcs/engines/wood-connections.js` — DOM-free, `window.WC` (also
  `module.exports` when `module` exists), `WC.compute(state) -> result`, `WC.runFixtures()`,
  `WC.ENGINE = {name:'wood-connection-schedule', version:1, rev:'2026-09-19 v1', codes:['NDS 2018']}`,
  `WC.DATA` (all tables below), `WC.newRow(type)` (defaults), `WC.defaultState()`.
- tests `tools/test-wood-connections.mjs`, `npm run test:wc` (loads the engine with `vm`/`require`
  like `tools/test-stacked-shearwall.mjs`, runs `runFixtures()`, exits non-zero on any failure).
- page `public/Calcs/wood_connection_schedule_calculator.html`.
- registry entry in `app/lib/calcs.ts`; §9 row in `docs/calc-state-spec.md`.

## 1. Units, load level, numbers
Lengths `in`, forces `lb`, stresses and E `psi`, angles `deg`. Demands are **ASD-level per
fastener** (`V` lateral, `T` withdrawal). The engine applies no load factors. Blank numeric
input = `null`. The engine never coerces `null` to 0.

## 2. Row status (authoritative — engine, UI badge, summary and fixtures use exactly these)
| status | when (precedence top → bottom) |
|---|---|
| `invalid` | any rejected input: non-finite or negative number; dimension/area/E/G/F_e not > 0; `n`/`rows` not a positive integer; D > 1; G outside 0.31–0.73; θ ∉ {0, 90}; lag with steel main; numeric T > 0 on a bolt; unsupported type/config |
| `incomplete` | any *active* required input is `null` (bolts: T is inactive, `null` T is fine) |
| `fail` | a fatal flag — evaluated before demand is looked at; capacities are suppressed (`null`) — or, with demand present, D/C > 1.0 |
| `nodemand` | no fatal flag and all active demands are numeric 0; capacities reported |
| `pass` | none of the above and D/C ≤ 1.0 |

Fatal flags: `p_min` (p below minimum), `geom_end`, `geom_edge`, `geom_row`, `geom_spacing`
(below hard minimum), `endgrain_withdrawal` (nail/wood screw in end grain with T > 0),
`spread5` (across-grain spread > 5 in without the detailing checkbox).
The summary counts rows per status (fail counted independently of D/C) and counts rows
with `unresolved > 0` (engineer checks printed but not computed).

## 3. State (`version: 1`)
```json
{
  "version": 1,
  "header": {
    "species": "DFL",            "E_override": null,
    "custom": { "name": "", "G": null, "E": null, "Fe_small": null, "Fe_par": null, "Fe_perp": null, "hardwood": false, "esr": "" },
    "steelGrade": "A36",          // "A36" (t >= 1/4, F_e 87,000) | "A653" (gauge, F_e 61,850)
    "mcFab": "dry", "mcService": "dry",   // "dry" (<= 19 %) | "wet" (> 19 %)
    "temp": "T100"                // "T100" (<= 100 F) | "T125" | "T150"
  },
  "bolts": [row], "nails": [row], "screws": [row],
  "rowCnt": 0
}
```
Species keys: `DFL, DFS, HF, SPF, SPFS, SP, CUSTOM`. `E_override` replaces the species
default E (psi) when numeric. Row `id` = `++rowCnt` (never reused; duplicate gets a new id;
order = array order).

### 3.1 Row fields
Common to every row: `id`, `desc` (≤ 120 chars, no `<>`), `V`, `T` (T inactive for bolts),
`loadCase` (`"D"→0.9, "L"→1.0, "S"→1.15, "Lr"→1.25, "WE"→1.6`), `cmException` (bool, Table 11.3.3 fn 2),
`main: {species, t, w, theta, endGrain, towardEnd, endDist, edgeDist, loadedEdgeDist}`,
`side: {mat:"wood"|"steel", species, t, w, theta, towardEnd, endDist, edgeDist, loadedEdgeDist, gauge}`
(`species` `null` = inherit header species; `gauge` ∈ `"20","18","16","14","12","11","10","7","3","plate"` for steel —
`plate` uses typed `t` ≥ 0.25 with A36; gauges use the thickness table with A653), `n`, `rows`, `s`, `g`,
`shrinkDetail` (bool), `Fyb_override` (psi or null), `notes` (free text).
Per type:
- **bolt**: `D` (`0.5, 0.625, 0.75, 0.875, 1`), `shear` (`"single"|"double"`), `mainSteel` (bool; steel main → `side.mat` must be wood; when true `main.t` is plate thickness ≥ 0.25 (A36) or gauge, `main.w` plate width).
- **nail**: `nailType` (`"common"|"box"|"sinker"`), `penny` (`"6d","7d","8d","10d","12d","16d","20d"`), `toeNail` (bool), `diaphragm` (bool, C_di), `doubleShear` not offered.
- **screw**: `screwType` (`"wood"|"lag"`), wood: `no` (`6,7,8,9,10,12,14`), `L` (typed, in); lag: `D` (`0.25 … 1`), `L` (`1,1.5,2,2.5,3,4,5,6,7,8,9,10,11,12`, limited by Table L2 availability).
Active-when: `n/rows/s/g/endDist/edgeDist/loadedEdgeDist/towardEnd/shrinkDetail` only for nominal
D ≥ 0.25; `loadedEdgeDist` only when that member's θ = 90; `side.w` only when D ≥ 0.25 (C_g);
`main.w` likewise; `T`/withdrawal fields never for bolts; `toeNail`/`diaphragm` nails only;
`mainSteel`/`shear` bolts only. Inactive fields are ignored by the engine and hidden by the UI.
Defaults (`WC.newRow`): main/side t = 1.5, w = 5.5, θ = 0, side wood inherits species; n = 1,
rows = 1, s = 4D, g = 1.5D (θ = 0) / 5D (θ = 90), endDist = 7D (θ = 0, toward end) / 4D,
edgeDist = 1.5D, loadedEdgeDist = 4D, towardEnd = true; loadCase "L"; nails 16d common L 3.5;
wood screw No. 10 L 3; lag 1/2 × 4; bolt 3/4 single.

## 4. Data (`WC.DATA`) — every value cited
- `SPECIES`: DFL {G 0.50, E 1.6e6}, DFS {0.46, 1.2e6}, HF {0.43, 1.3e6}, SPF {0.42, 1.4e6}, SPFS {0.36, 1.1e6},
  SP {0.55, 1.4e6}; all softwood. G: Table 12.3.3A p.87/101; E: Supplement Table 4A/4B No. 2.
- `STEEL`: A36 F_e 87,000; A653 F_e 61,850 (Table 12B/12K fn 2, 12M/12P fn 2; App. I.2 p.173/187);
  E_steel 30,000,000 (Table 11.3.6C header p.71/85). Gauges: 20→0.036, 18→0.048, 16→0.060, 14→0.075,
  12→0.105, 11→0.120, 10→0.134, 7→0.179, 3→0.239 (Table 12P p.112/126).
- `NAILS` Table L4 p.182/196 (D, L, head H): common 6d 0.113/2/0.266, 7d 0.113/2.25/0.266, 8d 0.131/2.5/0.281,
  10d 0.148/3/0.312, 12d 0.148/3.25/0.312, 16d 0.162/3.5/0.344, 20d 0.192/4/0.406; box 6d 0.099/2, 7d 0.099/2.25,
  8d 0.113/2.5, 10d 0.128/3, 12d 0.128/3.25, 16d 0.135/3.5, 20d 0.148/4; sinker 7d 0.099/2.125, 8d 0.113/2.375,
  10d 0.120/2.875, 12d 0.135/3.125, 16d 0.148/3.25, 20d 0.177/3.75 (sinker 6d 0.092 excluded: below the F_yb band).
  Box and sinker head diameters: read Table L4 (PDF 196) H columns; if absent for a type, use the common H of the
  same D band and record the assumption in `DATA.notes`. Tip E = 2D (L4 fn 2).
- `WOOD_SCREWS` Table L3 p.182/196 (D, D_r, D_H): 6 0.138/0.113/0.262, 7 0.151/0.122/0.287, 8 0.164/0.131/0.312,
  9 0.177/0.142/0.337, 10 0.190/0.152/0.363, 12 0.216/0.171/0.414, 14 0.242/0.196/0.480. T = max(4D, 2L/3)
  (fn 2/3), tip E = 2D (fn 6).
- `LAGS` Table L2 p.181/195: D → D_r, E: 1/4 0.173 5/32; 5/16 0.227 3/16; 3/8 0.265 7/32; 7/16 0.328 9/32;
  1/2 0.371 5/16; 5/8 0.471 13/32; 3/4 0.579 1/2; 7/8 0.683 19/32; 1 0.780 11/16. T by L: 1→0.75, 1.5→1.25,
  2→1.5, 2.5→1.75, 3→2, 4→2.5, 5→3, 6→3.5, 7→4, 8→4.5, 9→5, 10→5.5, 11→6, 12→6. Availability: L ≤ 1.5:
  D ≤ 1/2; L 2–2.5: D ≤ 5/8; L 3: D ≤ 1; L ≥ 4: all. Hex head → not a round head (pull-through n/a).
- `BOLTS` Table L1 p.180/194: D 0.5, 0.625, 0.75, 0.875, 1 (full body, D used throughout).
- `FYB` Table I1 p.175/189 by nominal D: nails/wood screws 0.099–0.142 → 100,000; (0.142, 0.177] → 90,000;
  (0.177, 0.236] → 80,000; (0.236, 0.273] → 70,000; (0.273, 0.344] → 60,000; (0.344, 0.375] → 45,000.
  Lags: 1/4 → 70,000; 5/16 → 60,000; ≥ 3/8 → 45,000. Bolts 45,000.
- `CM` Table 11.3.3 p.67/81 (fab, service): lateral — (dry,dry) 1.0; (wet,dry) 0.4, or 0.7 if D < 0.25, or 1.0
  if `cmException`; (·,wet) 0.7. Withdrawal lag/wood screw — service wet 0.7 else 1.0. Withdrawal nail —
  (dry,dry) 1.0, (wet,wet) 1.0, mixed 0.25; toe-nail withdrawal 1.0 always (§12.5.4.1). Pull-through —
  service wet 0.7 else 1.0.
- `CT` Table 11.3.4 p.67/81: T100 1.0; T125 dry 0.8 / wet 0.7; T150 dry 0.7 / wet 0.5 (dry = service dry).
- `CD`: D 0.9, L 1.0, S 1.15, Lr 1.25, WE 1.6 (Table 2.3.2; ≤ 1.6 §11.3.2).
- `GEOM` Tables 12.5.1A–E p.90–91/104–105 — as coded in §6.
- Constants: K_θ = 1 + 0.25(θ/90); K_D = 2.2 (D ≤ 0.17), 10D + 0.5 (0.17 < D < 0.25) (Table 12.3.1B p.84/98);
  C_eg lateral 0.67 (§12.5.2.2), lag withdrawal 0.75 (§12.2.1.3); C_di 1.1 (§12.5.3); C_tn 0.83 Z / 0.67 W (§12.5.4);
  γ = 180,000·D^1.5 wood-wood, 270,000·D^1.5 wood-metal (§11.3.6.1 p.68/82).

## 5. Engine algorithm (per row)
Validation first (§2). Then:

**5.1 Diameters.** `D` nominal. `D_yield` = D for bolts and nails; D_r for lags and wood screws
(§12.3.7.1(c) p.85/99). Everything outside the yield equations uses nominal D.

**5.2 Member properties.** For wood: G, E from species (header/custom, `E_override`). F_e (Table
12.3.3 p.86/100), rounded to the nearest 50 psi: D < 0.25 → `16600·G^1.84` (no angle); D ≥ 0.25 →
∥ `11200·G`, ⊥ `6100·G^1.45/√D`; F_e(θ) = ∥ at 0, ⊥ at 90 (only those two). Custom: typed values.
End grain on the main (`main.endGrain`) with D ≥ 0.25 → F_em = F_e⊥ (record cite §12.3.3.x from the
PDF text — search "end grain" on PDF 98–100 — in `cites`). Steel: F_e by grade, E 30e6.

**5.3 Lengths** (nails / wood screws / lags; bolts: l_m = t_m, l_s = t_s):
axis intervals from the head-side face: side `[0, t_s]`, main `[t_s, t_s + t_m]`, tip `[L−E, L]`,
threads: lag `[L−T, L−E]`, wood screw `[L−T, L]`, nail `[0, L]`. With `∩` = overlap length ≥ 0:
`p_tot = [t_s, L] ∩ main`; `tip_in = tip ∩ main`; `p_excl = p_tot − tip_in`; `l_m = p_tot − tip_in/2`
(§12.3.5.3 p.85/99); `l_s = t_s`; `p_t = threads ∩ main`; `exits_main = L > t_s + t_m` (warning).
p_min: lag `p_excl ≥ 4D` (§12.1.4.6); wood screw / nail `p_tot ≥ 6D` (§12.1.5.6 / §12.1.6.4). Fail → `p_min`.
Toe-nail (nails, wood side): `l_s = min(t_s, L/3)` (§12.3.10.2); `l_m = min(L·cos30° − L/3, t_m)`
(Comm. Eq. C12.5.4-1, PDF 280); `p_t = min(L − L/(3·cos30°), t_m/cos30°)` (Comm. C12.5.4.1 "actual
length of nail in the member"); p_min `p_t ≥ 6D`.

**5.4 Yield modes** (Table 12.3.1A p.83–84/97–98), R_e = F_em/F_es, R_t = l_m/l_s, D = D_yield, F_yb:
k1 = [√(R_e + 2R_e²(1+R_t+R_t²) + R_t²R_e³) − R_e(1+R_t)]/(1+R_e);
k2 = −1 + √(2(1+R_e) + 2F_yb(1+2R_e)D²/(3F_em l_m²));
k3 = −1 + √(2(1+R_e)/R_e + 2F_yb(2+R_e)D²/(3F_em l_s²)).
Single: I_m = D l_m F_em/R_d; I_s = D l_s F_es/R_d; II = k1 D l_s F_es/R_d; III_m = k2 D l_m F_em/((1+2R_e)R_d);
III_s = k3 D l_s F_em/((2+R_e)R_d); IV = D²/R_d·√(2F_em F_yb/(3(1+R_e))).
Double (bolts): I_m; I_s = 2D l_s F_es/R_d; III_s = 2k3 D l_s F_em/((2+R_e)R_d); IV = 2D²/R_d·√(…).
R_d (Table 12.3.1B): 0.25 ≤ D_yield ≤ 1 → 4K_θ (I_m, I_s), 3.6K_θ (II), 3.2K_θ (III, IV); D_yield < 0.25 with
nominal D < 0.25 → K_D (all modes); nominal D ≥ 0.25 with D_yield < 0.25 → K_D(D_yield)·K_θ (fn 1).
θ for K_θ = max(θ_m, θ_s over wood members). Z = min over modes; `governing` = mode name.

**5.5 Withdrawal** (main member G; bolts none): lag W = 1800·G^1.5·D^0.75 (Eq. 12.2-1); wood screw
W = 2850·G²·D (12.2-2); nail W = 1380·G^2.5·D (12.2-3) — lb/in, p.76–79/90–93. End grain: lag C_eg 0.75;
nail/wood screw with T > 0 → fatal `endgrain_withdrawal`. W' = W·C_D·C_M,w·C_t·C_eg·C_tn. Withdrawal
capacity per fastener `Wcap = W'·p_t`.
**Head pull-through** (§12.2.5 p.82/96, wood side, round heads = nails and wood screws): D_H from the
data, t_ns = t_s; W_H = 690·π·D_H·G_s²·t_ns for t_ns ≤ 2.5D_H, else 1725·π·D_H²·G_s² (Eq. 12.2-6a/b);
W_H' = W_H·C_D·C_M,H·C_t (Table 11.3.1). `Wcap = min(W'·p_t, W_H')`, `withdrawalGov` = "withdrawal" |
"pull-through". Lags (hex head) and steel side members: no pull-through value — `notes` "head/washer
pull-through per §12.2.5 / §11.1.1.3 not computed", `unresolved += 1` (only when T > 0).

**5.6 Adjustment factors** (Table 11.3.1 p.66/80): Z' = Z·C_D·C_M·C_t·C_g·C_Δ·C_eg·C_di·C_tn.
C_eg 0.67 when `main.endGrain` (all dowel types, lateral). C_di 1.1 when `diaphragm`. C_tn 0.83 when
`toeNail`. C_g and C_Δ per §6 (D ≥ 0.25 only, else 1.0).

**5.7 Demand.** Per §2. With demand: D/C_V = V/Z'; D/C_T = T/Wcap; combined when both > 0:
α = atan2(T, V); lag/wood screw Eq. 12.4-1 `Z'_α = Wcap·Z'/(Wcap·cos²α + Z'·sin²α)`; nail Eq. 12.4-2
`Z'_α = Wcap·Z'/(Wcap·cosα + Z'·sinα)` (p.89/103 — read both from the PDF and record the text in
`cites`); D/C_comb = √(V²+T²)/Z'_α. `dc = max(...)`.

**5.8 Engineer notes** (strings in `notes`, counted in `unresolved` where stated): lag/wood screw
with T > 0 → "root-area steel tension: T = … lb vs A_r = π·D_r²/4 = … in² per §11.2.3 (not computed)"
(`unresolved`); steel member → "plate bearing / net section per AISC (not computed)" (`unresolved`);
bolt → "hole 1/32–1/16 in oversize, washers under head and nut (§12.1.3.2/.3)"; lag → "lead holes
§12.1.4.2/.3"; wood screw → "§12.1.5.2/.3"; nail → "bored holes §12.1.6.2"; all → "§12.3.1(a)–(d):
faces in contact, load ⊥ to fastener axis, fasteners in aligned rows, geometry per §12.5"; bolt →
"threads excluded from bearing or ≤ 1/4 of bearing length (§12.3.7.2)"; custom → the ESR line.

## 6. C_g and C_Δ (nominal D ≥ 0.25)
**C_g** Eq. 11.3-1 (p.68/82): per member area A: wood θ = 0 → t·w; wood θ = 90 → t·w_group,
`w_group = rows ≥ 2 ? (rows − 1)·g : 4D` (§11.3.6.3 "minimum parallel to grain spacing" = Table 12.5.1B
∥ full value); steel → t·w. Double shear A_s = 2·(side area). R_EA = min(E_sA_s/(E_mA_m), E_mA_m/(E_sA_s));
u = 1 + γ(s/2)(1/(E_mA_m) + 1/(E_sA_s)); m = u − √(u²−1);
C_g = [m(1−m^{2n}) / (n[(1+R_EA m^n)(1+m) − 1 + m^{2n}])]·[(1+R_EA)/(1−m)]. n = 1 → 1.0. n = fasteners in a row
(rows are parallel to the load; no stagger).

**C_Δ** §12.5.1 (p.89–90/103–104). `lD = min(l_m, Σ l_s over WOOD members) / D` (Table 12.5.1C/D fn 1; steel
excluded; single shear Σl_s = t_s if wood). For each wood member with its θ, hardwood flag, `towardEnd`:
- θ = 0: end full = towardEnd ? (hardwood ? 5D : 7D) : 4D; end half = towardEnd ? (hardwood ? 2.5D : 3.5D) : 2D;
  edge min = lD ≤ 6 ? 1.5D : max(1.5D, g/2); row spacing min 1.5D.
- θ = 90: end full 4D, end half 2D; loaded edge min 4D, unloaded edge min 1.5D; row spacing min
  lD ≤ 2 ? 2.5D : lD < 6 ? (5·l + 10D)/8 : 5D (l = lD·D).
- spacing in a row (both θ): full 4D, min 3D.
Hard minimums → fatal `geom_*` when violated: edge (and loaded edge at θ = 90), row spacing (rows ≥ 2),
end < end half, s < 3D (n ≥ 2). Otherwise `C_Δ = min(1, endDist/endFull (each wood member), s/4D (n ≥ 2))`.
V = 0 with T > 0 on a lag → Table 12.5.1E instead: edge ≥ 1.5D, end ≥ 4D, s ≥ 4D, C_Δ = 1.
Across-grain spread per wood member: θ = 0 → (rows−1)·g; θ = 90 → (n−1)·s; > 5 → fatal `spread5` unless
`shrinkDetail` (then a note). (§12.5.1.3)

## 7. Result shape
```
{ engine:{name,version,rev}, header:{...resolved, species:{G,E,...}, steel:{Fe,E}},
  tables:{ bolts:[rowResult], nails:[...], screws:[...] },
  summary:{ perTable:{bolts:{worstDC, worstId, counts:{pass,fail,nodemand,incomplete,invalid}, unresolved}, ...}, total:{...} } }
rowResult = { id, type, status, flags:[], warnings:[], notes:[], cites:[], unresolved:n,
  inputs:{resolved echo incl. D, D_yield, Fyb, L, T_thread, E_tip},
  members:{ main:{mat,G,E,Fe,theta,t,w,A}, side:{...} },
  lengths:{ p_tot, tip_in, p_excl, l_m, l_s, p_t, p_min, exits_main, lD },
  yield:{ Re, Rt, Ktheta, KD, Rd:{Im,Is,II,IIIm,IIIs,IV}, k1,k2,k3, modes:{Im,Is,II,IIIm,IIIs,IV}, Z, governing },
  factors:{ CD, CM, CMw, CMH, Ct, Cg, Cdelta, Ceg, Cegw, Cdi, Ctn, each with cite },
  capacity:{ Zp, W, Wp, Wcap_withdrawal, WH, WHp, Wcap, withdrawalGov, Zalpha, alpha },
  demand:{ V, T, dcV, dcT, dcComb, dc } }
```
Suppressed capacities on fatal flags are `null`. Numbers are unrounded; the UI rounds.

## 8. Fixtures (`runFixtures()` returns `{pass, fail, results:[{name, expected, got, tol, ok}]}`)
Tolerance = half the unit of the cell's last printed digit, asserted on the unrounded result:
`|got − expected| ≤ tol + 1e-9`. Read each cell from `nds.txt` and record `table`, `row`, `col`.
1. Table 12A (PDF 108–109) bolt 1/2, t_m = t_s = 1.5, G 0.50 both, single: Z∥ 480 (tol 5), Z_s⊥ 300, Z⊥ 220
   (+ Z_m⊥ from the table). Same for bolt 3/4 and 1 at two more thicknesses read from the table (≥ 6 cells).
2. Table 12B (steel side 1/4 A36) two cells; Table 12F (double shear wood) two cells; Table 12G (double shear
   A36 sides) two cells. Steel main single shear: hand-computed expected with intermediates in the fixture.
3. Table 12J lag 1/4, t_s 1/2, G 0.50, p_excl = 8D: Z∥ 120 (tol 5), Z⊥ 80; plus 3/8 and 1/2 lag cells.
   Table 12K two cells.
4. Table 12L No. 10, t_s 1/2, G 0.50, p_tot = 10D: 90 (tol 0.5 → assert ≤ 1); plus No. 8 and 14 cells. 12M two cells.
5. Table 12N common 6d/8d/10d/16d, G 0.50, t_s 3/4: 72/90/105/121; t_s 1: 72/97/118/141 (tol 0.5 → ≤ 1). Box 8d
   and sinker 10d cells. 12P two cells.
6. Withdrawal: 12.2A lag 1/4 G 0.50 = 225 (check the cell), 12.2B No. 10 G 0.50 = 135, 12.2C 8d common
   (0.131) G 0.50 = 32; one more cell each at G 0.42.
7. Pull-through Table 12.2F (PDF 96): G 0.50 D_H 0.234 t_ns 5/16 → 40; D_H 0.312 t_ns 1 → 132; G 0.42 D_H 0.500
   t_ns 1-1/2 → 239 (tol 0.5).
8. C_g Table 11.3.6A (PDF 84): three cells incl. A_s/A_m = 1, A_s = 12, n = 4; Table 11.3.6C two cells (E_s 30e6).
   Hand-computed ⊥-member cases (rows = 2 and rows = 1) with intermediates.
9. Branch matrix (expected values computed by hand in the fixture source, with the arithmetic shown):
   I_m/III_m governing (short l_m); D_r = 0.17 boundary (K_D 2.2 vs 10D+0.5); nominal 0.25 with D_r < 0.25 (fn 1);
   p = p_min − 0.01 → fail `p_min`, p = p_min → not fail; Codex lag 1/4 × 6 (T 3.5), t_s = t_m = 1.5 → p_t 0.5;
   nail 16d through 1.5 side into 0.75 main → p_tot 0.75 → fail `p_min`; s = 3D − ε fail, 3D → C_Δ 0.75, 4D → 1,
   8D → 1 (cap); end at half (C_Δ 0.5) and below (fail); each C_M combination × (D < 0.25, ≥ 0.25) × (lateral,
   withdrawal nail, withdrawal lag, pull-through); toe-nail 16d 2x→2x (l_s 1.1667, l_m 1.5 capped, p_t 1.7321
   capped) and 8d common L 2.5 into t_m 3.5 (l_m 1.3317, p_t 1.5377, no cap); end grain: bolt lateral C_eg 0.67
   and F_em = F_e⊥; lag withdrawal 0.75; nail T > 0 → fail; (0,0) → nodemand; (0,0) + short lag → fail;
   one blank demand on a nail → incomplete; bolt T null → pass/fail on V; bolt T = 10 → invalid; n = 0, n = 2.5,
   E = 0, w = 0 → invalid; θ = 45 → invalid; spread: one ⊥ row of 4 bolts at s = 2 → 6 in → fail, with
   shrinkDetail → pass; combined discriminator: force Z' = Wcap = 100 (via a test hook `WC._combined(type,
   V, T, Zp, Wcap)`) → nail D/C 1.0 at V = T = 50, wood screw at 70.71.

## 9. UI contract
- Toolbar: `<script src="/are-utils-v2.js" data-are-wide-default>`; Project + Mark; use `AREv2.getMarkHTML()`
  for anything in innerHTML. Copy the toolbar/head boilerplate from `stacked_shearwall_calculator.html`.
- Header block (Tier-A inputs, ids `#species #E_override #custom_* #steelGrade #mcFab #mcService #temp`)
  outside `#schedule`.
- `#schedule` holds three `<section data-table="bolts|nails|screws">`, each a `<table>` with one
  `<tbody data-row-id>` per connection: summary `<tr class="wc-sum">` (desc, fastener label, V, T, Z', Wcap,
  D/C, status badge, row buttons) → indented `<tr class="wc-in">` (inputs, only active ones rendered; inactive
  factors shown as "n/a — reason") → `<tr class="wc-det">` details (always in the DOM; `hidden` on screen until
  the row's "details" toggle; always visible in print). Details list lengths, member properties, all modes with
  the governing one marked, R_d/K, factor chain with cites, capacities, flags/warnings/notes/cites.
- Row buttons: add (per table), duplicate, delete, up, down. All edits go through `upd(rowId, path, value)` →
  `state` → `render()`; never read numbers from the DOM for calculation.
- Summary block `#summary` under the tables: per-table worst D/C (row desc), status counts, unresolved count,
  `WC.ENGINE.rev`.
- Adapter (Tier B, copy the shearwall pattern):
  `AREv2.registerAdapter({version:1, ownedFields:['#schedule'], schema:{allowedKeys:['version','header','bolts',
  'nails','screws','rowCnt'], maxDepth:8, maxNodes:20000, maxStringLength:120, stringPattern:<no <> or control chars>},
  getModel(){return deep copy of state minus header (header fields are Tier-A DOM)}, setModel(m){refuse
  version!==1; validate arrays; state.bolts/nails/screws/rowCnt = m…; readHeaderFromDOM(); render()},
  runAndSettle(){readHeaderFromDOM(); render()}})`; expose `window.__WC_ADAPTER = cfg` and `window.__WC_STATE`
  getter for tests.
- Print: `@media print` shows every `.wc-det`, hides buttons, page-break-before each section after the first,
  header once, summary last. Input restyling scoped `#schedule input, #schedule select { … !important }`.
- Palette/typography: match `stacked_shearwall_calculator.html` (muted ARE palette).

## 10. Registry
```ts
{ slug: "wood-connection-schedule", label: "Wood Connection Schedule",
  subtitle: "NDS 2018 Ch. 12 · bolts, nails, wood screws, lags · per-project connection schedule",
  htmlFile: "/Calcs/wood_connection_schedule_calculator.html", category: "Connections", spec: "NDS 2018",
  status: "wip", keywords: ["wood","connection","bolt","nail","lag","wood screw","NDS","yield","withdrawal","dowel","schedule"],
  material: "Wood", calcType: "Connections", icon: "shearwall" }
```

## 11. Amendments after implementation review (2026-09-19)
- **K_θ for an end-grain main member = 90°** (Table 12.3.1B defines θ per member as the angle between load and grain; a lateral load on a fastener whose axis is parallel to the grain is perpendicular to that member's grain). Conservative; recorded in `cites`. C_g areas and C_Δ for that member still use the typed θ (Table 12.5.1 is written for side grain).
- **Lag length L**: the engine accepts any L > 0 (Table L2 availability by D still enforced); a listed L takes T from Table L2, otherwise T = min(6, L/2 + 0.5) (Table L2 fn 2) with a warning. Needed so fixtures can set p_excl = 8D exactly. The UI offers the listed lengths only.
- `main.species: null` inherits the header species (same as side).
- Invalid / incomplete reasons ride `warnings[]` as `"Invalid: …"` / `"Incomplete: …"`.
- `cmException` is honored only for nominal D ≥ 1/4 in (the UI renders it only then); a D < 1/4 fastener under (wet, dry) always gets C_M = 0.7 — the conservative reading of Table 11.3.3 fn 2.
- §11.3.6.3 single-row width for a ⊥-loaded member = 3D (Table 12.5.1B minimum ∥ spacing), per Fable's final verification.
- l/D for Tables 12.5.1C/D uses the fastener length in the wood main member (p_tot) for nails/screws/lags, t_m for bolts (fn 1).
- Head pull-through outside the Table 12.2F t_ns range (5/16–1-1/2 in) is computed from Eq. 12.2-6 with a warning.
- The ∥ edge-distance "½ row spacing" term (Table 12.5.1C, l/D > 6) applies only when rows ≥ 2.
- Withdrawal-only lag rows (Table 12.5.1E branch) do not run the §12.5.1.3 5 in spread check (that clause governs laterally loaded groups).
- Rows that are `invalid` / `incomplete` must not contribute to the summary's unresolved-check count.

## 12. v1.1 — intermediate load angles and staggered rows (Nick, 2026-09-19)
`WC.ENGINE.rev = '2026-09-19 v1.1'`; state `version` stays 1 (new fields optional, absent = old behavior).

### 12.1 Load angle θ per wood member, any 0 ≤ θ ≤ 90 (typed, deg)
- Validation: θ non-finite, < 0 or > 90 → `invalid`. Steel members have no θ.
- F_e(θ) per member: Table 12.3.3 F_e∥ / F_e⊥ (D ≥ 1/4) combined by Hankinson Eq. 12.3-11
  `F_eθ = F_e∥·F_e⊥ / (F_e∥·sin²θ + F_e⊥·cos²θ)`, then rounded to 50 psi; D < 1/4 unchanged (no angle).
- K_θ = 1 + 0.25·(θ_max/90) with the actual max θ over wood members (Table 12.3.1B).
- Geometry (§12.5.1, Tables 12.5.1A–D) for a member with 0 < θ < 90 — the mandatory text gives no
  intermediate rule, so: **end distance** full and half values linearly interpolated between the θ = 0
  value (tension `towardEnd` 7D/3.5D softwood, 5D/2.5D hardwood; compression 4D/2D) and the θ = 90 value
  (4D/2D) by θ/90 (Commentary C12.5.1.2: "End distances for angle to grain tension loadings may be
  linearly interpolated…"); **spacing in a row** 4D full / 3D min (same at both angles); **edge
  distance** = the ⊥ rule (loaded edge 4D, unloaded edge 1.5D) — the load has a ⊥ component toward one
  edge, so `loadedEdgeDist` is active for 0 < θ ≤ 90; **row spacing** = the greater of the ∥ (1.5D)
  and ⊥ (Table 12.5.1D by l/D) minima. Print a note "geometry at θ = … by interpolation (end) and the
  governing of the ∥/⊥ rules (edge, rows) — Commentary C12.5.1.2".
- Across-grain spread for the 5 in rule (§12.5.1.3), per member: extent of the group measured ⊥ to
  that member's grain = `(n − 1)·s·sinθ + (rows − 1)·g·cosθ` (reduces to the θ = 0 / 90 cases).
- C_g areas at 0 < θ < 90: compute C_g twice — with the gross areas (θ = 0 rule) and with the
  ⊥ equivalent areas (θ = 90 rule, w_group as §6) — and use the **smaller C_g**; `factors.Cg.detail`
  records both. Note printed: "C_g at an angle: lesser of the ∥ and ⊥ area interpretations (§11.3.6.3)".
- §12.6.2 note printed for any row with 0 < θ < 90 and n·rows > 1: "gravity axis of each member must
  pass through the center of resistance of the fastener group (§12.6.2)".
- UI: θ becomes a numeric input (0–90, step 1) with 0 / 90 quick buttons; `loadedEdgeDist` shown when
  θ > 0.

### 12.2 Staggered rows (§11.3.6.2, D ≥ 1/4 only)
- New row fields: `stagger` (bool, default false) and `offset` (in, longitudinal offset between the
  closest fasteners in adjacent rows measured parallel to the rows; default s/2 when stagger is turned
  on; active only when `stagger && rows ≥ 2`). Validation: offset must be > 0 and < s, else `invalid`.
- Rule: if `g < offset / 4` the adjacent rows are one row for C_g: `n_eff = 2n`, `s_eff = offset`,
  `rows_eff = ceil(rows / 2)` (even rows → each pair merges; odd rows → "most conservative
  interpretation": the merged-row n_eff = 2n, s_eff = offset governs the whole group). Otherwise
  (g ≥ offset/4) rows stay separate: n_eff = n, s_eff = s. C_g uses n_eff and s_eff; all physical
  geometry checks (Table 12.5.1B spacing s, 12.5.1D row spacing g, edge, end, spread) use the physical
  s and g; the ⊥ equivalent width uses the physical (rows − 1)·g. `factors.Cg.detail` records
  `{stagger, offset, merged, n_eff, s_eff, rows_eff}`; cite "§11.3.6.2 (Fig. 11B)".
- Note printed when stagger is on and a member is loaded ⊥ to grain: "§12.6.1 — stagger symmetrically".
- Fixtures: g < offset/4 → merged (n_eff 2n, s_eff offset), C_g hand-computed; g ≥ offset/4 → unmerged
  equals the non-stagger result; rows = 3 stagger → rows_eff 2; offset ≥ s → invalid; stagger with
  rows = 1 → ignored (fields inactive). Angle fixtures: θ = 45 F_e by Hankinson (rounded), K_θ 1.125,
  end full = interpolated (e.g. softwood tension 1/2 bolt: 3.5 → 2.0 at 90, 2.75 at 45), loaded edge
  active, row-spacing = max(∥, ⊥), spread at 45 with n = 3, s = 2, rows = 2, g = 1.5 → 2·2·sin45 +
  1.5·cos45 = 3.889; C_g at 45 = min of the two interpretations; θ = 91 / −1 → invalid.

### 12.3 Post-verification amendments (Fable v1.1 report, 2026-09-20)
- Stagger merge uses the closest-fastener offset `offClosest = min(offset, s − offset)` (§11.3.6.2); merged row `s_eff = s/2`, `n_eff = 2n`, `rows_eff = ceil(rows/2)`; `C_g = min(merged, separate)`.
- Spread with stagger: along-row extent `(n − 1)·s + offClosest`.
- Unloaded edge at 0 < θ < 90 = max(1.5D, g/2 when l/D > 6 and rows ≥ 2).
- F_eθ by Hankinson from the rounded ∥/⊥ values, used unrounded (exact at 0/90).
- The §12.6.2 center-of-resistance note counts as an unresolved engineer check.
- `geomDefaults(D, θ, towardEnd, hardwood)` interpolates the end distance like `compute`.

## 13. v1.2 — Simpson Fastener Designer parity (Nick, 2026-09-20)
Reference: Simpson Strong-Tie Fastener Designer (FD) report `calculation result.pdf` (Nick's desktop). Goal: same
inputs and the same output blocks, in the same order, per connection. `WC.ENGINE.rev = '2026-09-20 v1.2'`; state
version stays 1 (new fields optional; absent = v1.1 behavior).

### 13.1 Member dimension semantics (the question that triggered this)
`t` = the member dimension **along the fastener axis** (depth the fastener travels into that member); `w` = the face
dimension across the fastener (C_g area only). A ledger screwed into the narrow face of a 2x stud has main t = stud
depth (3.5 / 5.5), main w = 1.5. UI labels: "t — along fastener (in)", "w — across fastener (in)", with a title tooltip
carrying the ledger example. The `exits_main` warning text becomes "fastener exits the main member: L − t_s = … >
t_m = … — lengths capped at t_m" and is shown in the summary row, not only in details.

### 13.2 Fastener pattern and connection totals (FD "Fastener Pattern", W_total, Z_total)
- `n` (per row) and `rows` become **active for every fastener type** (they were D ≥ 1/4 only). `qty = n · rows`.
  Spacing/edge/end/geometry inputs stay D ≥ 1/4 only for C_Δ; for D < 1/4 the same inputs are rendered so the
  advisory check in 13.3 can run, but they never fail the row.
- New row field `demandBasis`: `"per"` (default for existing files) | `"total"`. New numeric fields `V_total`,
  `T_total` (ASD lb, whole connection). When `demandBasis === "total"`: V = V_total / qty, T = T_total / qty (the
  per-fastener fields are derived and shown read-only); when `"per"` the existing V/T fields are the inputs and
  totals are derived (V_total = V · qty). Status rules (§2) apply to whichever pair is the input.
- Results add `capacity.Z_total = qty · Z'`, `capacity.W_total = qty · Wcap`, `demand.V_total`, `demand.T_total`,
  `demand.qty`, and percentage forms `demand.pctV = 100·V/Z'`, `pctT`, `pctComb` (FD shows "Demand/Resistance %").
- Summary row shows qty, Z_total, W_total and D/C.

### 13.3 Minimum spacing requirements block (FD "Minimum Spacing Requirements")
`result.spacingReq = { basis, a1_par, a2_perp, end_loaded, end_unloaded, edge_loaded, edge_unloaded, rows_inline,
rows_staggered, checks:[{name, required, actual, ok}] }` per row, all in inches (nD evaluated with nominal D):
- **D ≥ 1/4 (bolts, lags)** — `basis: "NDS Table 12.5.1A–D (C_Δ = 1.0 values; hard minima in checks)"`: a1_par = 4D
  (Table 12.5.1B ∥ full), a2_perp = 4D (attached-member rule, spec §6), end_loaded = the C_Δ = 1.0 end distance
  for the row's θ/towardEnd/hardwood (interpolated per §12), end_unloaded = 4D (compression / ⊥), edge_loaded = 4D
  (⊥ loaded edge), edge_unloaded = 1.5D or the ∥ l/D rule (spec §6, §12), rows_inline = the Table 12.5.1D minimum for
  the row's l/D and θ, rows_staggered = same (NDS gives no separate staggered value; state "same as in-line").
  `checks` echoes the existing hard-minimum results (these already drive `geom_*` flags).
- **D < 1/4 (nails, wood screws)** — `basis: "Commentary Table C12.1.5.7 (wood screws) / C12.1.6.6 (nails),
  advisory (PDF 268–269)"`, new row field `prebored` (bool, default false) and the side material: wood side —
  edge 2.5D; end tension ∥ 15D / 10D (not prebored / prebored), compression ∥ 10D / 5D; in-row ∥ 15D / 10D,
  ⊥ 10D / 5D; rows in-line 5D / 3D, staggered 2.5D / 2.5D. Steel side — edge 2.5D; end tension 10D / 5D,
  compression 5D / 3D; in-row ∥ 10D / 5D, ⊥ 5D / 2.5D; rows in-line 3D / 2.5D, staggered 2.5D. Choose ∥ vs ⊥ by the
  main member's θ (0 → ∥, 90 → ⊥, intermediate → the larger), tension vs compression by `towardEnd`. `checks` compare
  the row's typed s / g / endDist / edgeDist against these and produce **warnings only** (`"advisory spacing: s = …
  < 15D = …"`), never a fatal flag, and a printed note "spacing for D < 1/4 in per NDS §12.1.5.7 / §12.1.6.5
  (sufficient to prevent splitting); Commentary table used as the recommendation".
- Fixtures: bolt 1/2 at θ 0 tension softwood → end_loaded 3.5, a1 2.0, edge_unloaded 0.75, rows_inline 0.75;
  same at θ 90 → end 2.0, edge_loaded 2.0, rows per l/D; 16d nail wood side not prebored → edge 0.405, end 2.43,
  a1 2.43, a2 1.62, rows 0.81 / 0.405; prebored → 1.62 / 1.62 / 0.81 / 0.486; steel side values; a nail row with
  s = 1.0 → warning present, status unaffected.

### 13.4 Fastener properties echo
`inputs` gains `D_H` (head diameter used for pull-through; null for lags/bolts) and `coating: null` (FD shows it;
we have no product data — the page prints "—"). Existing D, D_r (as D_yield), F_yb, L, T_thread, E_tip stay.

### 13.5 Details block order (page) — match the FD report
1. Fastener properties (type/size, D, D_r, D_H, L, thread T, tip E, F_yb + source)
2. Adjustment factors (C_D, C_M, C_t, C_g, C_Δ, C_eg, C_di, C_tn, K_θ — value + cite)
3. Penetration (p_tot, p_excl, tip in main, l_m, l_s, p_min, exits-main line)
4. Fastener pattern (n per row, rows, qty, s, g, stagger/offset, merged/separate C_g if any)
5. Minimum spacing requirements (table from 13.3 with required / actual / ok per line, basis line)
6. Withdrawal (p_t, W lb/in with equation, W', W_H and W_H' or "n/a — hex head / steel side", W_cap per
   fastener, W_total, demand T / T_total, Demand/Resistance %)
7. Lateral (F_em, F_es, θ per member, R_e, R_t, K_θ/K_D, k1–k3, six modes with R_d and Z, Z_min + governing mode,
   Z', Z_total, demand V / V_total, Demand/Resistance %)
8. Combined (α, Z'_α, equation used, combined demand, Demand/Resistance %)
9. Notes / engineer checks / cites (unchanged)
Summary row: desc · fastener · qty · V_total · T_total · Z_total · W_total · D/C · status.

### 13.6 Inputs block order (page) — match the FD input panel
Fastener (type, size, L, load case, F_yb override, prebored for D < 1/4) · Load (demand basis toggle, V/T or
V_total/T_total, shear planes for bolts) · Side member A (material, species, t along fastener, w across, θ, E shown
read-only from species) · Main member B (same + end grain) · Pattern (rows, n per row, s, g, stagger, offset,
end/edge distances) · Factors (read-only chips). Keep everything inside the existing `.wc-in` row; the FD column
labels ("Side Member A", "Main Member B") are adopted.
