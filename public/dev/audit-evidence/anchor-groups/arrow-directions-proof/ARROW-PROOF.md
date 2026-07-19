# Arrow-direction visual proof — VERDICT: PASS

Nick asked for a **visual** double-check of the load-arrow directions (a prior
agent only did DOM assertions). Each screenshot below was rendered in headless
Chrome from the deployed pages (served from `public/`), captured as a clipped
PNG, and **visually inspected pixel-by-pixel**. Every arrow is correct — no
sideways purple arrows anywhere, no wrong directions.

Screenshots in this folder:

## 1. `embed-preset-picker.png` — preset thumbnail row — PASS
Shows all five thumbnails (1 / 2V / 2H / 2×2 / 3×2), with 2×2 highlighted (the
default). In **every** thumbnail:
- **V** is a blue arrow pointing **straight DOWN** (gravity).
- **P** is the purple **⊙ out-of-page circle-dot symbol** (a small filled dot
  inside an open circle) — **never a sideways arrow.**
- The **3×2** thumbnail (rightmost) is **VERTICAL**: **6 dots in 3 rows × 2
  columns** (tall), labelled "3×2". It is NOT a horizontal 2×3.
- Caption reads: "…V = gravity (↓), P = out-of-plane tension (⊙ toward viewer)."

(Source cross-check: `lp_3x2` thumbnail draws circles at cx=11,25 (2 columns) ×
cy=6,15,24 (3 rows); the V `<line>` runs top→bottom with the arrowhead marker at
the bottom; P is a stroked circle + filled dot, no marker. Confirmed visually.)

## 2. `embed-preset-picker-3x2active.png` — picker with 3×2 selected — PASS
Same row captured with the 3×2 preset active (highlight moves to 3×2). Confirms
the highlight tracks the active layout; arrows unchanged and correct.

## 3. `embed-elevation.png` — elevation/section sketch (default 2×2, Case 1 gravity) — PASS
- **V**: large blue arrow pointing **vertically DOWN** at the beam-bearing line
  (standoff dimension e = 2.00" shown below it). ✔ vertical-down at the bearing line.
- **P**: purple arrow pointing **horizontally to the RIGHT — away from the wall
  face** (the CMU wall/section is on the left; the beam extends right). ✔ horizontal, away from wall.
- Supporting couple arrows are sensible: red **T (couple)** at the top anchor
  row, green **C bearing** at the bottom compression edge. Title: "ELEVATION/
  SECTION — CASE 1 GRAVITY (top row tension)."

## 4. `embed-wallface-3x2.png` — wall-face (projected) sketch, 3×2 preset active — PASS
- **6 anchors arranged 3 rows × 2 columns** (vertical group). ✔
- **V**: blue arrow pointing **DOWN** (top-right of the sketch). ✔
- **P**: purple **⊙ "P (out)"** out-of-page symbol beneath V — no sideways arrow. ✔
- Per-anchor breakout cones + red overlap lenses drawn; governing anchor ringed
  and labelled **"GOV T"** (middle row, right column) with **"GOV V"** on the
  near-edge anchors — this matches the results banner (Ba governs @ Middle row ·
  Col B), confirming the highlight and the math agree.
- Sx (horizontal) and r (vertical row spacing) dimension strings present.

## 5. `tow-discrete-section-1x4.png` — TOW discrete section (1 row across thickness) — PASS
- **T = 13.00 kips (total)**: red arrow pointing **UP, out of the top of the
  wall** (tension pulling the ledger/anchor plate off the wall top). ✔ "T up out
  of wall top."
- **V = 13.00 kips (total)**: red arrow drawn **horizontally** at the top of the
  wall, pointing left (into the wall from the near/loaded face, which is
  labelled on the right). ✔ horizontal shear toward the wall, per the calc's
  single-named-direction convention.
- Section shows the grouted cell, wall thickness b = 7.625", lbe = 3.81".

## 6. `tow-discrete-plan-1x4.png` — TOW discrete plan (1×4 = 4 anchors) — PASS
- 4 anchors in a single row along the wall length at **s = 8.00"**. ✔
- Near face / far face labelled; per-anchor breakout cones drawn and overlapping.
- Governing anchors highlighted and labelled: **"GOVERNS TENSION (R1C2)"** (2nd
  anchor, red) and **"GOVERNS SHEAR (R1C1)"** (end anchor, orange) — matches the
  per-anchor results table (R1C2 Apt-governing, R1C1 Apv-governing). ✔
- (Force arrows live in the section view; the plan view carries the breakout
  geometry + governing-anchor callouts, which is the intended split.)

---

## Overall verdict: PASS — all arrows correct
- Every V arrow (thumbnails, wall-face, elevation) points **down** (gravity).
- Every P is the **⊙ out-of-page symbol**; **no sideways/horizontal purple
  arrow appears anywhere** in any wall-face/thumbnail view.
- The elevation's P is the one intentional horizontal P — pointing **away from
  the wall face** — which is correct for that side view.
- The 6-anchor embed preset is **vertical 3×2 (3 high × 2 wide)** as required.
- TOW section T is **up out of the wall top**; V is horizontal toward the loaded
  face. Governing-anchor highlights agree with the numeric results.

No arrow defects found. No calc files were modified.
