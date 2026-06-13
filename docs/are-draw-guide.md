# are-draw.js — Integration Guide (for calc-retrofit agents)

*Track 1 deliverable · Anderson Rohr Engineering · pairs with `docs/calc-state-spec.md`*

`are-draw.js` is a dependency-free SVG diagram library that replaces the hand-rolled,
string-concatenated inline SVGs in the calcs (e.g. `areDrawSchematic()` in
`W_beam_to_HSS_column_calculator.html`). It draws clean, to-scale, annotated 2D
diagrams (IDEA StatiCa / SkyCiv style) from a **Calc State** object.

You give it a `<svg>` element and a Calc State; it draws the diagram. Nothing else.

---

## 1. Add the script

Each calc is a plain HTML file. Drop this near the other `<script>` tags
(`window.AREDraw` becomes available — no module system, no build step):

```html
<script src="/are-draw.js"></script>
```

Add (or reuse) a target `<svg>` where the diagram should appear:

```html
<svg id="areDia" xmlns="http://www.w3.org/2000/svg" width="100%" style="max-height:340px"></svg>
```

> The library **clears and rewrites** the `<svg>` you hand it and auto-fits the
> `viewBox`. You do **not** set `viewBox` yourself.

---

## 2. The one call you make

High-level renderers each take `(svgElement, calcState, options?)`:

| Function | Use for |
|---|---|
| `AREDraw.renderConnection(svg, state, opts)` | the three flagship connection calcs (dispatches on `state.calcType`) |
| `AREDraw.renderMember(svg, state, opts)` | a generic beam/column/wall (elevation + section + shear/moment diagram) |

`opts` is optional:

```js
{
  resolvedGeometry: { "W16X57": {...}, "HSS10X10X1/2": {...} }, // see §4
  dark: false,              // dark-theme variant
  style: { force:'#c42b2b' }// override any style token
}
```

Redraw on input change by calling the same renderer again (it fully replaces the SVG).

---

## 3. Map your calc's existing JS variables → a Calc State

The Calc State shape is fixed by `docs/calc-state-spec.md` + `calc-state.schema.json`.
Build a plain object literal from the values your calc already reads off the form.
Key rules you must not get wrong:

- **`member.section` and every `*.section`** = UPPERCASE `AISC_Manual_Label`
  (`W16X57`, `HSS10X10X1/2`, `HSS10.000X0.500`). If your `<select>` values are
  lowercase-x (`HSS10x10x1/2`), `.toUpperCase()` them before assigning.
- **Moment units differ by calcType** — kip-ft for `w-to-hss-column` & `base-plate`,
  **kip-IN** for `hss-to-hss-branch`. Pass `demands.Mu` in the unit the spec mandates.
- The **primary member** in `member.section` is: the **beam** (w-to-hss-column),
  the **column** (base-plate), the **branch** (hss-to-hss-branch). The secondary
  member goes in the `connection` block.

Per-calcType `connection` blocks (only the fields the renderer reads are listed;
include the rest for schema validity):

```js
// w-to-hss-column
connection: { column: { section: hssLabel, Fy: colFy }, beamFy: beamFy }

// base-plate
connection: {
  plate:    { N, B, tp, Fyp },
  anchors:  { n, dia, gauge, grade },
  concrete: { fc, hef, cEdge }
}

// hss-to-hss-branch
connection: {
  subType: 'rect-moment'|'round-moment'|'truss',
  connType: 'T'|'Y'|'X'|'KG'|'KO',
  chord: { section: chordLabel, Fy: chordFy },
  branchFy, theta, Qf, orient: 'H'|'B', gap, overlap
}
```

---

## 4. Feeding section geometry (important — read this)

The renderer needs `d/bf/tf/tw` (W) or `B/H/t` (rect HSS) or `OD/t` (round HSS).
It resolves geometry in this priority:

1. **`opts.resolvedGeometry`** — a `{ LABEL: geom }` map you pass in. **Preferred**,
   because your calc already holds the section properties in JS (e.g. the `W_DB` /
   `H_DB` lookups). Accepted geometry shapes (any one works):
   - W: `{ d, bf, tf, tw }` (the bundled JSON record shape works as-is)
   - rect HSS: `{ H, B, t }`  ·  round HSS: `{ OD, t }`
   - or pre-tagged: `{ kind:'W'|'rectHSS'|'roundHSS', ... }`
2. **A registered shape DB** via `AREDraw.setShapeDB(json)` — pass the parsed
   `/data/aisc-shapes-v16.json` once at startup. Covers **W/M/S/HP only**.
3. **Label parser fallback** — if neither has the section, the library parses the
   AISC label. For HSS it applies the **0.93 design-wall factor** (`t_des = 0.93·t_nom`),
   so `HSS10X10X1/2` → `{H:10, B:10, t:0.465}`. (W-shape fallback is approximate;
   always supply W geometry via 1 or 2.)

> **Why this matters:** `/data/aisc-shapes-v16.json` has **no HSS**. For any HSS
> section, either pass `resolvedGeometry` from your calc's HSS lookup (your `H_DB`
> array is `[A, H, B, t_des]` → map index 1/2/3 to `H/B/t`) or rely on the label
> parser. Don't expect `setShapeDB` alone to resolve HSS.

Mapping your existing `H_DB`/`W_DB` arrays to `resolvedGeometry`:

```js
var W = W_DB["W16X57"];   // [A, d, bf, tf, tw]
var H = H_DB["HSS10X10X1/2"]; // [A, H, B, t_des]
var resolvedGeometry = {
  "W16X57":      { d: W[1], bf: W[2], tf: W[3], tw: W[4] },
  "HSS10X10X1/2":{ H: H[1], B: H[2], t: H[3] }
};
```

---

## 5. Worked example (≈20 lines) — retrofit `W_beam_to_HSS_column_calculator.html`

Replace the body of the old `areDrawSchematic()` with a Calc State build + one call:

```js
function areDrawSchematic(){
  var svg = document.getElementById('areDia');
  if (!svg || !window.AREDraw) return;

  var wKey = document.getElementById('wsec').value.toUpperCase(); // 'W16X57'
  var hKey = document.getElementById('hsec').value.toUpperCase(); // 'HSS10X10X1/2'
  var W = W_DB[wKey] || W_DB[wKey.toLowerCase()];   // [A,d,bf,tf,tw]
  var H = H_DB[hKey] || H_DB[hKey.toLowerCase()];   // [A,H,B,t]

  var state = {
    schema: 'are.calc.v1', calcType: 'w-to-hss-column',
    member:  { type:'beam', section: wKey, material:{ Fy: 50 } },
    demands: { Mu: +document.getElementById('Mu').value },      // kip-ft
    connection: { column: { section: hKey, Fy: 46 }, beamFy: 50 }
  };
  var resolvedGeometry = {};
  if (W) resolvedGeometry[wKey] = { d:W[1], bf:W[2], tf:W[3], tw:W[4] };
  if (H) resolvedGeometry[hKey] = { H:H[1], B:H[2], t:H[3] };

  AREDraw.renderConnection(svg, state, { resolvedGeometry: resolvedGeometry });
}
['wsec','hsec','Mu'].forEach(function(id){
  var el = document.getElementById(id);
  if (el) ['input','change'].forEach(function(ev){ el.addEventListener(ev, areDrawSchematic); });
});
areDrawSchematic();
```

That's the whole retrofit: ~20 lines replacing the ~80-line `s += '<rect …>'`
string builder, now consistent in style with every other calc.

---

## 6. Public API quick reference

High-level (what retrofits use):
`renderConnection`, `renderMember`, `setShapeDB`, `resolveSection`, `parseSectionLabel`.

Composable primitives (for one-off custom diagrams):
`new AREDraw.Drawing(svg, {style})`, `new AREDraw.View(dwg, {scale, ox, oy, flipY})`,
then `wSection / wElevation / rectHSSSection / roundHSSSection / tubeElevation / plate /
bolt / boltPattern / centerline / weldFillet / dimLine / leader / forceArrow /
distLoad / momentArrow / viewTitle / memberLabel`, finishing with `dwg.commit()`.
Every function is JSDoc-documented in `public/are-draw.js`.

Formatting + style helpers: `fmtIn / fmtKip / fmtKft / fmtKin`, `fitScale`,
`AREDraw.LIGHT` / `AREDraw.DARK` style tokens (mirrors `are-theme-v2.css`).

---

## 7. Do / don't

- **Do** keep emitting UPPERCASE AISC labels and the spec's per-calcType moment units.
- **Do** pass `resolvedGeometry` whenever your calc already knows the geometry.
- **Don't** set the `<svg>` `viewBox` yourself — the library auto-fits it.
- **Don't** modify `are-draw.js` per-calc; override via `opts.style` if you need a tweak.
