# HANDOFF — Independent cross-check of the Channel Lintel calculator

_Prepared 2026-08-19 for a NEW session. Assume the reader knows nothing about this work._

Your job is to **independently cross-check** a finished structural calculator: its code references,
its numerical results, and its engineering assumptions — **and to run an adversarial Codex review**.
You are a reviewer, not the author. Do not take the author's claims on trust; several of them were
wrong during development and were only caught by re-derivation.

---

## 0. What the calculator is

A steel channel lintel over a **new opening cut into an existing CMU wall**. A matched pair of
channels, one on each wall face, web flat against the masonry and depth vertical, thru-bolted through
newly grouted cells. Load reaches the channels only through rod bearing. End reactions go into
grouted CMU jamb piers through bolted connections.

**Design basis: NON-COMPOSITE.** The two channels act independently; each resists its share of
out-of-plane wind in weak-axis bending. Composite action about the wall centreline exists in the code
as an **informational-only mode** that cannot produce a PASS and is excluded from the optimiser.

---

## 1. Files

| File | Role |
|---|---|
| `public/Calcs/masonry_opening_channel_lintel_calculator.html` | UI, sketches, algebra rendering |
| `public/Calcs/js/masonry_opening_channel_lintel_engine.js` | **DOM-free check engine — the thing to review** |
| `public/Calcs/js/channel_db.js` | 72 C+MC shapes, generated from the AISC xlsx |
| `public/Calcs/js/channel_lintel_fixtures.js` | 61 headless assertions |
| `docs/channel-lintel-hand-check-2026-08.md` | Longhand hand check |
| `PLAN-CHANNEL-LINTEL.md` | Design plan, rev 12 |
| `PLAN-CHANNEL-LINTEL-REVIEW-LOG.md` | 7 Codex rounds + 2 Fable passes, full argument |
| `app/lib/calcs.ts` | Registry entry, slug `masonry-opening-channel-lintel`, status `wip` |

Run the fixtures first:

```bash
cd "C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs"
node public/Calcs/js/channel_lintel_fixtures.js
```

Expected: `61 passed, 0 failed`. If not, stop and report.

---

## 2. Reference case — reproduce these five numbers

MC18X42.7 · 8" CMU (`t = 7.625`, `t_w = 0.45`) · `L = 28 ft` · `s = 16"` staggered · 2 rows at
`g = 12"` · ¾" A307 rod · `f'm = 1900 psi` · `w_cmu = 70 psf` · `H_above = 16 ft` · `p = 30 psf` over
5 ft tributary · `L_b = 16"` · 5 jamb bolts · 50/50 sharing.

| Check | DCR |
|---|---|
| Gravity flexure, AISC F2 | 0.350 |
| Shear, G2 | 0.064 |
| Wind flexure, F6 | 0.367 |
| H1-1b interaction | 0.716 |
| **Rod combined (von Mises)** | **0.783** |
| Grout bearing | 0.185 |
| Gravity deflection, L/600 | 0.926 ← governs |
| Wind deflection, 0.42W vs L/240 | 0.750 |

Verdict: **PASS**, governing = gravity deflection.

---

## 3. Source documents for reference checking

- **TMS 402-22 full text:** `C:\Users\nickh\OneDrive - Rohr Engineering\RE CODING\Masonry\tms_full.txt`
  (grep it — do not cite TMS from memory)
- **AISC shape properties:** `public/Calcs/aisc-shapes-database-v16.0.xlsx`
- **AISC 360-22 itself is NOT available locally.** Every AISC citation is therefore unverified against
  the spec. Flag any you doubt.
- **Original Tedds calc** the work is based on:
  `C:\Users\nickh\OneDrive\Desktop\LINTEL 1 - Design of New Opening In Masonry Wall.docx`

### Citations to verify

| Citation | Used for |
|---|---|
| TMS 4.4.4 | bearing area, A₂ enhancement deliberately not taken |
| TMS 4.6 | `l/600`, scope is beams supporting **unreinforced** masonry |
| TMS 5.1.1.1 | point-load dispersion 2V:1H, **3V:1H adjacent to an opening** |
| TMS 9.1.4.1(d) | φ = 0.50 breakout / crushing / pryout |
| TMS 9.1.4.2 | φ = 0.60 bearing |
| TMS 9.1.6.3.1 Eq. 9-2 | rod steel tension |
| TMS 9.1.6.3.2 Eq. 9-4, 9-5, 9-7 | breakout, crushing, steel shear |
| TMS 9.1.6.3.3 Eq. 9-8 | tension+shear interaction, 5/3 exponents |
| TMS 9.1.8 | bearing `0.8 f'm A_br` |
| TMS 9.3 | bond beam, jamb pier |
| AISC F2 / **Eq. F2-8b** | channel LTB with the singly-symmetric `c` factor |
| AISC F6, G2, H1-1b, J3.6, J3.7, J3.10 | weak axis, shear, interaction, bolts |
| IBC Table 1604.3 note (f) | wind deflection `L/240` at `0.42W` |

---

## 4. Specific things to attack

These are the author's judgment calls. Each is defensible and each could be wrong.

1. **`e_o` datum.** Claim: AISC `e_o` is measured from the **back of the web**, on the flange-opposite
   side, so bolt-line-to-shear-centre is `e = e_o + t_w/2 = 1.194 in` for MC18X42.7. Verify with
   `e_cl = 3·t_f·b'²/(6·b'·t_f + h·t_w)`, `b' = b_f − t_w/2`. Author checked all 72 shapes, worst 0.64%.
2. **Masonry demand basis.** Masonry checks use the rod's **total force on the grout**
   (`V_mas = √((V_x·n_rows)² + P_rod²)`), not the halved per-plane steel shear. Steel checks use the
   per-plane value. Is that split right?
3. **Eq. 9-1 and Eq. 9-6 are NOT credited.** Reason given: `A_pt` is not constructible for a rod
   passing through hollow cells, unit webs and bed joints, so a full-thickness cone would
   *overpredict*. Is not-crediting them conservative, or is it hiding a real limit state?
4. **Rod bending is a real limit state the reference calc never checked.** Gravity-plane
   `M_grav = (P_rod/2)(L_g/2 − L_c/4)`, `L_g = t + t_w`. Verify the free body.
5. **Staggered layout.** Two lengths that were conflated once already and must stay distinct:
   - `trib_rod = s/n_rows` — load tributary per rod. **Same staggered or in-line.**
   - `pitch` — rod-to-rod along the span. `s/n_rows` staggered, `s` in-line. Drives bond-beam span only.
6. **`L_b` defaults to the full span** and is an engineer input. Automatic App. 6 brace reduction is
   deliberately **not implemented**. At full span `φM_n,x` falls 202.8 → 64.9 k-ft and the reference
   section fails, which is why the input exists. Is exposing it the right call?
7. **Sharing ratio governs**, it is not a diagnostic sweep. Default 50/50, selectable to 100/0.
8. **Composite mode quarantine.** Verify it truly cannot PASS and is excluded from `optimise()`.
9. **Bond beam** uses a simplified `j·d = 0.9d` and `M = w·L_bb²/10`.
10. **Jamb bolt group** ignores group eccentricity `e_group` — a known gap.

---

## 5. Two OPEN items — do not let them be quietly closed

1. **Phase 0 gate, NOT closed.** Tedds' `M_u = 72.7 k-ft` back-solves to `w = 0.7418 klf`, but
   `1.2·(1120/2 + 42.7) = 0.7235` (−2.5%). Best fit is Tedds' own displayed member UDL of 0.57 klf
   plus self weight (−0.64%), so the residual lives in a Tedds input step not visible in the export.
   Fixture A is **formally split** and **no claim of 2% reference reproduction may appear** in the UI
   or the docs. Verify that claim is still absent.
2. **AISC Appendix 6 equations unverified.** An earlier revision cited `0.01·M_r·C_d/h_o` to A-6-7,
   which matches no edition. Discrete rods are **point** braces (App. 6.3.1b), not relative/panel.
   The automatic reduction is disabled. If you have AISC 360-22, resolve this.

Also note: **Tedds ran only `1.2D+1.6SL`. `1.4D` governs this job.** The reference under-checked.

---

## 6. Development history worth knowing

The plan went through 12 revisions, 7 adversarial Codex rounds and 2 Fable passes. Three findings
changed the engineering, and two of them reversed the author's own conclusions:

- **Composite action does not engage with standard holes.** Corrected pre-engagement slip lever is
  `2(x̄ − t_w/2) = 1.304 in`, not `2·z_ch = 9.379 in` — the first version used the composite
  plane-section lever to predict when composite action *begins*, which is circular. `w_slip = 0.302 klf`
  against a design `w_w = 0.150 klf`.
- **Epoxy in the masonry annulus fixes the wrong interface.** Longitudinal shear crosses the
  **channel-web hole**. Only a welded shear plate makes composite action real, and no weld design
  exists. Hence the informational-only quarantine.
- **Grout bearing governs before rod flexure in composite mode**, and `f_g = k/d_b` means **rod
  diameter and spacing relieve it; rod grade does not.**

Full argument in `PLAN-CHANNEL-LINTEL-REVIEW-LOG.md` (1,203 lines).

---

## 7. Required: adversarial Codex cross-check

Run Codex **read-only** and hand it this file plus the engine. Suggested invocation:

```bash
cd "C:/Users/nickh/OneDrive - Rohr Engineering/RE CODING/ARE Web Calcs/anderson-rohr-calcs"
codex exec -s read-only --json -o /tmp/codex-crosscheck.txt "You are an adversarial reviewer performing an INDEPENDENT CROSS-CHECK of a finished structural engineering calculator. Read HANDOFF-CHANNEL-LINTEL-CROSSCHECK.md first, then public/Calcs/js/masonry_opening_channel_lintel_engine.js, then public/Calcs/js/channel_lintel_fixtures.js. TMS 402-22 full text is at '../../Masonry/tms_full.txt' - grep it to verify every TMS citation rather than relying on memory. AISC shape data is in public/Calcs/aisc-shapes-database-v16.0.xlsx. Your job: (1) verify every code reference actually says what the engine claims; (2) re-derive the numerical results in section 2 of the handoff independently and report any you cannot reproduce, with your number; (3) attack the ten judgment calls in section 4; (4) confirm the two open items in section 5 have not been quietly closed. Be skeptical and specific. For each finding give a one-line fix. Do NOT modify any files. End your reply with EXACTLY one line: 'VERDICT: APPROVED' if the calculator is sound enough to seal, or 'VERDICT: REVISE' if it has material problems." < /dev/null 2>/dev/null | grep '"type":"thread.started"'
```

Then read `/tmp/codex-crosscheck.txt`, arbitrate each finding (Codex advises, it does not command),
and append the exchange to `PLAN-CHANNEL-LINTEL-REVIEW-LOG.md` under `## Cross-check round 1`.

Codex was wrong at least six times across the prior rounds — most notably it claimed the `e_o` datum
was wrong when it was not. **Verify before you accept, and log any rejection with its reason.**

---

## 8. Definition of done for the cross-check

- [ ] 61 fixtures pass on a clean checkout
- [ ] Every TMS citation verified against `tms_full.txt`
- [ ] Every AISC citation either verified or explicitly flagged unverified
- [ ] The five reference DCRs independently reproduced, or discrepancies reported with numbers
- [ ] Each of the ten judgment calls in §4 either endorsed or challenged
- [ ] The two open items in §5 confirmed still open and still disclosed in the UI
- [ ] Codex cross-check run, arbitrated, and logged
- [ ] A clear recommendation: seal as `ready`, or list what must change first

Status stays `wip` in `app/lib/calcs.ts` until Nick signs off.
