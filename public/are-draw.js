/* ============================================================================
 * are-draw.js  —  ARE parametric SVG drawing library
 * ----------------------------------------------------------------------------
 * Anderson Rohr Engineering · shared structural diagram engine.
 *
 * A dependency-free, classic (non-module) script. It builds 2D, to-scale,
 * annotated steel-connection and member diagrams from a "Calc State" object
 * (see docs/calc-state-spec.md) directly as SVG DOM, replacing the ~50 ad-hoc
 * inline SVGs scattered across the ARE web calculators.
 *
 * The library has two layers:
 *   1. A small set of composable PRIMITIVES (steel outlines, plates, bolt
 *      patterns, weld marks, dimension lines, force/moment arrows, hatching)
 *      wrapped in a Drawing canvas that maps real-world inches -> pixels and
 *      auto-fits the viewBox.
 *   2. High-level RENDERERS that consume a Calc State and lay out a complete,
 *      labeled diagram (renderConnection, renderMember).
 *
 * Usage (browser):
 *   <svg id="dia" xmlns="http://www.w3.org/2000/svg"></svg>
 *   <script src="/are-draw.js"></script>
 *   <script>
 *     AREDraw.renderConnection(document.getElementById('dia'), calcState);
 *   </script>
 *
 * Everything is exposed on the global  window.AREDraw .
 *
 * No external libraries, no <canvas>, pure SVG DOM construction.
 * ==========================================================================*/
(function (global) {
  'use strict';

  var SVGNS = 'http://www.w3.org/2000/svg';

  /* ==========================================================================
   * STYLE TOKENS
   * --------------------------------------------------------------------------
   * Single source of truth for line weights, colors, fonts. Colors mirror the
   * ARE brand tokens defined in public/are-theme-v2.css (navy family + status
   * greens/reds). Object (steel) lines are heavier than dimension lines, which
   * matches drafting convention and the IDEA StatiCa / SkyCiv look.
   *
   * Consumers may override any token per-call via options.style.
   * ========================================================================*/

  /**
   * Default ARE drawing style tokens.
   * @typedef {Object} AREDrawStyle
   * @property {string} font            Font family for all text.
   * @property {number} fsTitle         View-title font size (px).
   * @property {number} fsLabel         Member/section label font size (px).
   * @property {number} fsDim           Dimension text font size (px).
   * @property {number} fsForce         Force/moment value font size (px).
   * @property {string} steel           Steel object line / outline color.
   * @property {string} steelFill       Steel fill (secondary members).
   * @property {string} steelFillHi     Steel fill (the designed/primary member).
   * @property {string} hatch           Section hatch line color.
   * @property {string} weld            Weld symbol color.
   * @property {string} dim             Dimension line + text color (muted).
   * @property {string} force           Force/axial arrow accent color.
   * @property {string} moment          Moment arc color.
   * @property {string} center          Centerline color.
   * @property {string} bg              Optional background fill (transparent).
   * @property {number} lwObject        Object (steel) line weight (px).
   * @property {number} lwObjectThin    Thin object line weight (px).
   * @property {number} lwDim           Dimension line weight (px).
   * @property {number} lwForce         Force arrow line weight (px).
   * @property {number} lwCenter        Centerline weight (px).
   */
  var LIGHT = {
    font: "'DM Sans','Segoe UI',system-ui,-apple-system,sans-serif",
    fsTitle: 13, fsLabel: 11.5, fsDim: 10.5, fsForce: 11,
    steel: '#1a2b5f',        // --v2-navy
    steelFill: '#dbe2f0',    // light navy tint (secondary members)
    steelFillHi: '#fde68a',  // amber — the designed/primary member
    hatch: '#8595bd',
    weld: '#2e4a8a',         // --v2-navy-mid
    dim: '#6b7a96',          // --v2-muted
    force: '#c42b2b',        // --v2-fail / accent
    moment: '#b3651a',       // warm accent for moments
    center: '#9aa6c2',
    bg: 'transparent',
    title: '#1a2b5f',
    lwObject: 2, lwObjectThin: 1.2, lwDim: 1, lwForce: 2, lwCenter: 0.9
  };

  // Dark variant — used when the host theme reports a dark color-scheme.
  var DARK = Object.assign({}, LIGHT, {
    steel: '#cdd8f2',
    steelFill: '#26365e',
    steelFillHi: '#7a6320',
    hatch: '#6b7aa6',
    weld: '#7e9bd6',
    dim: '#9aa6c2',
    force: '#ef6a6a',
    moment: '#e0a050',
    center: '#5a6688',
    title: '#cdd8f2'
  });

  /**
   * Resolve the active style: base tokens + caller overrides. Dark awareness is
   * opt-in via opts.dark === true (the calcs are light-only today, but the host
   * theme supports a future dark mode).
   * @param {Object} [opts] Options object possibly carrying .dark and .style.
   * @returns {AREDrawStyle}
   */
  function resolveStyle(opts) {
    opts = opts || {};
    var base = opts.dark ? DARK : LIGHT;
    return Object.assign({}, base, opts.style || {});
  }

  /* ==========================================================================
   * LOW-LEVEL SVG HELPERS
   * ========================================================================*/

  /**
   * Create an SVG element in the SVG namespace and apply attributes.
   * @param {string} tag SVG tag name (e.g. 'rect', 'path', 'text').
   * @param {Object} [attrs] Attribute map. Null/undefined values are skipped.
   * @returns {SVGElement}
   */
  function el(tag, attrs) {
    var node = (global.document
      ? global.document.createElementNS(SVGNS, tag)
      : makeShimNode(tag));
    if (attrs) {
      for (var k in attrs) {
        if (attrs[k] === null || attrs[k] === undefined) continue;
        node.setAttribute(k, attrs[k]);
      }
    }
    return node;
  }

  /**
   * Round a number to a tidy precision for SVG coordinate output.
   * @param {number} n
   * @param {number} [p=2] decimal places
   * @returns {number}
   */
  function r(n, p) {
    var f = Math.pow(10, p == null ? 2 : p);
    return Math.round(n * f) / f;
  }

  /**
   * Append a text node, returning the created element.
   * @param {SVGElement} parent
   * @param {number} x
   * @param {number} y
   * @param {string} str
   * @param {Object} [attrs] Extra attributes (fill, font-size, text-anchor...).
   * @returns {SVGElement}
   */
  function text(parent, x, y, str, attrs) {
    var t = el('text', Object.assign({ x: r(x), y: r(y) }, attrs || {}));
    t.textContent = String(str);
    parent.appendChild(t);
    return t;
  }

  /* ==========================================================================
   * NUMBER FORMATTING (engineering units per spec §4)
   * ========================================================================*/

  /**
   * Format a length value in inches with a trailing inch mark.
   * @param {number} v inches
   * @param {number} [dp=2] max decimals (trailing zeros trimmed)
   * @returns {string} e.g.  10"  or  16.43"
   */
  function fmtIn(v, dp) {
    return trimNum(v, dp == null ? 2 : dp) + '"';
  }

  /**
   * Format a force in kips.
   * @param {number} v kips
   * @returns {string} e.g.  53.2 k
   */
  function fmtKip(v) { return trimNum(v, 1) + ' k'; }

  /**
   * Format a moment in kip-ft.
   * @param {number} v kip-ft
   * @returns {string} e.g.  60 k-ft
   */
  function fmtKft(v) { return trimNum(v, 1) + ' k-ft'; }

  /**
   * Format a moment in kip-in.
   * @param {number} v kip-in
   * @returns {string} e.g.  600 k-in
   */
  function fmtKin(v) { return trimNum(v, 1) + ' k-in'; }

  /** Trim trailing zeros from a fixed-decimal number. @private */
  function trimNum(v, dp) {
    if (v == null || !isFinite(v)) return '—';
    var s = Number(v).toFixed(dp);
    if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, '');
    return s;
  }

  /* ==========================================================================
   * SECTION GEOMETRY RESOLUTION
   * --------------------------------------------------------------------------
   * The renderer's geometry sources, in priority order:
   *   1. Caller-supplied resolved geometry (options.resolvedGeometry) — the
   *      calcs already hold section properties in JS and can hand them in.
   *   2. The bundled W/M/S/HP JSON (window.__AISC_W_SHAPES__ if a calc has
   *      loaded public/data/aisc-shapes-v16.json, or AREDraw.setShapeDB()).
   *   3. A label PARSER that extracts B/H/t (rect HSS) and OD/t (round HSS)
   *      from the AISC_Manual_Label, applying the 0.93 design-wall factor for
   *      HSS (t_des = 0.93 * t_nom).
   * ========================================================================*/

  // Optional W/M/S/HP shape DB, keyed by uppercase AISC_Manual_Label.
  var SHAPE_DB = null;

  /**
   * Register a W/M/S/HP shape database (e.g. the parsed contents of
   * public/data/aisc-shapes-v16.json) for label resolution. Keys must be the
   * uppercase AISC_Manual_Label; values carry at least d/bf/tf/tw.
   * @param {Object<string,Object>} db
   */
  function setShapeDB(db) { SHAPE_DB = db || null; }

  /**
   * Parse a fractional or decimal dimension token to a number.
   * "1/2" -> 0.5, "5/16" -> 0.3125, "0.500" -> 0.5, "10" -> 10.
   * @param {string} tok
   * @returns {number} NaN if unparseable.
   * @private
   */
  function parseDimToken(tok) {
    if (tok == null) return NaN;
    tok = String(tok).trim();
    if (tok.indexOf('/') >= 0) {
      var p = tok.split('/');
      return parseFloat(p[0]) / parseFloat(p[1]);
    }
    return parseFloat(tok);
  }

  /**
   * Normalize one caller-supplied geometry object (or the bundled JSON record)
   * into the canonical internal shape used by the primitives.
   * @param {Object} g raw geometry-ish object
   * @returns {Object|null}
   * @private
   */
  function normalizeGeom(g) {
    if (!g || typeof g !== 'object') return null;
    // Already canonical?
    if (g.kind === 'W' || g.kind === 'rectHSS' || g.kind === 'roundHSS') return g;
    // W-shape JSON record (d/bf/tf/tw present, no explicit kind)
    if (g.d != null && g.bf != null && g.tf != null) {
      return { kind: 'W', d: +g.d, bf: +g.bf, tf: +g.tf, tw: +(g.tw != null ? g.tw : g.tf) };
    }
    // Rect HSS record (H/B/t)
    if (g.H != null && g.B != null && g.t != null) {
      return { kind: 'rectHSS', H: +g.H, B: +g.B, t: +g.t };
    }
    // Round HSS record (OD/t)
    if ((g.OD != null || g.D != null) && g.t != null) {
      return { kind: 'roundHSS', OD: +(g.OD != null ? g.OD : g.D), t: +g.t };
    }
    return null;
  }

  /**
   * Resolve a section by AISC_Manual_Label into canonical geometry. Tries the
   * caller-supplied resolved map first, then the registered shape DB, then the
   * label parser.
   * @param {string} section AISC_Manual_Label (case-insensitive accepted).
   * @param {Object<string,Object>} [resolved] Caller-supplied label->geometry.
   * @returns {Object} canonical geometry; always returns *something* usable.
   */
  function resolveSection(section, resolved) {
    if (!section) return { kind: 'rectHSS', H: 8, B: 8, t: 0.291, _fallback: true };
    var key = String(section).toUpperCase().trim();

    // 1. Caller-supplied resolved geometry (exact or case-insensitive).
    if (resolved) {
      var hit = resolved[section] || resolved[key];
      if (!hit) {
        for (var rk in resolved) {
          if (rk.toUpperCase() === key) { hit = resolved[rk]; break; }
        }
      }
      var ng = normalizeGeom(hit);
      if (ng) return ng;
    }

    // 2. Registered W/M/S/HP shape DB.
    if (SHAPE_DB) {
      var rec = SHAPE_DB[section] || SHAPE_DB[key];
      if (!rec) {
        for (var sk in SHAPE_DB) {
          if (sk.toUpperCase() === key) { rec = SHAPE_DB[sk]; break; }
        }
      }
      var ngd = normalizeGeom(rec);
      if (ngd) return ngd;
    }

    // 3. Parse the label.
    return parseSectionLabel(key);
  }

  /**
   * Parse an AISC_Manual_Label to canonical geometry. Handles:
   *   - Round HSS / Pipe:  HSS10.000X0.500 , HSS10.000X0.500 , PIPE...  -> roundHSS
   *   - Rect/Square HSS:   HSS10X10X1/2 , HSS12X4X3/8                   -> rectHSS
   *   - W/M/S/HP:          W16X57  (approximate proportions if no DB)   -> W
   * For HSS the nominal wall is converted to a design wall: t_des = 0.93*t_nom.
   * @param {string} key uppercase label
   * @returns {Object} canonical geometry (with _fallback:true when approximated)
   */
  function parseSectionLabel(key) {
    key = String(key).toUpperCase().trim();

    // Round HSS / round structural tube: "HSS<OD>.000X<wall>" or "HSS10X0.5"
    // Detect "round" by exactly two numeric tokens after HSS, with a decimal OD.
    var mRound = key.match(/^(?:HSS|PIPE)\s*([\d.]+)\s*X\s*([\d./]+)$/);
    if (mRound) {
      var od = parseFloat(mRound[1]);
      var tnomR = parseDimToken(mRound[2]);
      return { kind: 'roundHSS', OD: od, t: r(0.93 * tnomR, 4), _fallback: true };
    }

    // Rect/Square HSS: "HSS<H>X<B>X<t>"
    var mRect = key.match(/^HSS\s*([\d.]+)\s*X\s*([\d.]+)\s*X\s*([\d./]+)$/);
    if (mRect) {
      var H = parseFloat(mRect[1]);
      var B = parseFloat(mRect[2]);
      var tnom = parseDimToken(mRect[3]);
      return { kind: 'rectHSS', H: H, B: B, t: r(0.93 * tnom, 4), _fallback: true };
    }

    // W/M/S/HP shape: "W16X57" — approximate proportions from nominal depth and
    // weight when no DB is available. d ~= nominal, bf/tf/tw via typical ratios.
    var mW = key.match(/^([WMSH]P?|HP)\s*([\d.]+)\s*X\s*([\d.]+)$/);
    if (mW) {
      var dNom = parseFloat(mW[2]);
      var wt = parseFloat(mW[3]);
      // Rough but proportionate: bf ~ 0.42d for light, narrows with depth.
      var d = dNom;
      var bf = Math.max(4, Math.min(0.65 * d, 0.55 * Math.sqrt(wt * d)));
      var tf = Math.max(0.2, 0.0125 * d + 0.0009 * wt);
      var tw = Math.max(0.15, tf * 0.62);
      return { kind: 'W', d: d, bf: r(bf, 2), tf: r(tf, 3), tw: r(tw, 3), _fallback: true };
    }

    // Unknown — return a neutral square HSS so the renderer still draws.
    return { kind: 'rectHSS', H: 8, B: 8, t: 0.291, _fallback: true };
  }

  /* ==========================================================================
   * DRAWING — the canvas / coordinate engine
   * --------------------------------------------------------------------------
   * Binds to an existing <svg> element, accumulates content into ordered
   * layers (steel below, annotations on top), tracks the world-space (inches)
   * extent of everything drawn, and on commit() computes a fit-to-content
   * viewBox with margins. A Drawing can host several independent "views"
   * (e.g. elevation + section) by offsetting their world origins.
   * ========================================================================*/

  /**
   * @typedef {Object} XY  A pixel-space point.
   * @property {number} x
   * @property {number} y
   */

  /**
   * Create a Drawing bound to an <svg> element.
   *
   * The Drawing works in PIXEL space directly (views place themselves with
   * their own inch->px scale, see View). The Drawing's job is layering, marker
   * defs, bbox tracking and viewBox auto-fit.
   *
   * @param {SVGSVGElement} svg The target <svg> element (will be cleared).
   * @param {Object} [opts]
   * @param {AREDrawStyle} [opts.style] Resolved style tokens.
   * @param {number} [opts.margin=18] Outer margin (px) around fitted content.
   * @constructor
   */
  function Drawing(svg, opts) {
    opts = opts || {};
    this.svg = svg;
    this.style = opts.style || LIGHT;
    this.margin = opts.margin != null ? opts.margin : 18;
    this.minX = Infinity; this.minY = Infinity;
    this.maxX = -Infinity; this.maxY = -Infinity;

    // Reset target.
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('xmlns', SVGNS);

    // <defs> for arrowheads / hatch patterns.
    this.defs = el('defs');
    svg.appendChild(this.defs);
    this._defKeys = {};
    this._installMarkers();

    // Ordered layers: steel (bottom) -> weld -> centerline -> annotation (top).
    this.gSteel = el('g', { 'class': 'are-layer-steel' });
    this.gWeld = el('g', { 'class': 'are-layer-weld' });
    this.gCenter = el('g', { 'class': 'are-layer-center' });
    this.gAnno = el('g', { 'class': 'are-layer-anno' });
    svg.appendChild(this.gSteel);
    svg.appendChild(this.gWeld);
    svg.appendChild(this.gCenter);
    svg.appendChild(this.gAnno);
  }

  /** Install reusable arrowhead markers + (later) hatch patterns. @private */
  Drawing.prototype._installMarkers = function () {
    var st = this.style;
    this._addArrow('areArrForce', st.force, 9, 'fill');
    this._addArrow('areArrDim', st.dim, 7, 'fill');
    this._addArrow('areArrMoment', st.moment, 8, 'fill');
  };

  /**
   * Add a triangular arrowhead marker once.
   * @param {string} id
   * @param {string} color
   * @param {number} size marker box size (px)
   * @private
   */
  Drawing.prototype._addArrow = function (id, color, size) {
    if (this._defKeys[id]) return;
    var m = el('marker', {
      id: id, markerWidth: size, markerHeight: size,
      refX: size - 1, refY: size / 2, orient: 'auto', markerUnits: 'userSpaceOnUse'
    });
    m.appendChild(el('path', { d: 'M0,0 L0,' + size + ' L' + size + ',' + (size / 2) + ' z', fill: color }));
    this.defs.appendChild(m);
    this._defKeys[id] = true;
  };

  /**
   * Lazily create a 45-degree section-hatch <pattern> and return its id.
   * @param {string} color
   * @param {number} [spacing=5] line spacing (px)
   * @returns {string} pattern id usable as fill="url(#id)"
   */
  Drawing.prototype.hatchPattern = function (color, spacing) {
    spacing = spacing || 5;
    var id = 'areHatch_' + String(color).replace(/[^a-z0-9]/gi, '') + '_' + spacing;
    if (!this._defKeys[id]) {
      var p = el('pattern', {
        id: id, width: spacing, height: spacing,
        patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)'
      });
      p.appendChild(el('line', { x1: 0, y1: 0, x2: 0, y2: spacing, stroke: color, 'stroke-width': 0.7 }));
      this.defs.appendChild(p);
      this._defKeys[id] = true;
    }
    return id;
  };

  /**
   * Expand the tracked bounding box to include a pixel point.
   * @param {number} x
   * @param {number} y
   */
  Drawing.prototype.extend = function (x, y) {
    if (x < this.minX) this.minX = x;
    if (y < this.minY) this.minY = y;
    if (x > this.maxX) this.maxX = x;
    if (y > this.maxY) this.maxY = y;
  };

  /**
   * Append a node to a named layer and (optionally) extend the bbox.
   * @param {SVGElement} node
   * @param {'steel'|'weld'|'center'|'anno'} [layer='anno']
   * @returns {SVGElement} node (for chaining)
   */
  Drawing.prototype.add = function (node, layer) {
    var g = layer === 'steel' ? this.gSteel
      : layer === 'weld' ? this.gWeld
        : layer === 'center' ? this.gCenter
          : this.gAnno;
    g.appendChild(node);
    return node;
  };

  /**
   * Finalize: compute and apply a fit-to-content viewBox (with margin). Safe to
   * call when nothing was drawn (falls back to a unit box).
   * @returns {SVGSVGElement} the bound svg
   */
  Drawing.prototype.commit = function () {
    var m = this.margin;
    if (!isFinite(this.minX)) { this.minX = 0; this.minY = 0; this.maxX = 100; this.maxY = 100; }
    var x = this.minX - m, y = this.minY - m;
    var w = (this.maxX - this.minX) + 2 * m;
    var h = (this.maxY - this.minY) + 2 * m;
    this.svg.setAttribute('viewBox', r(x, 1) + ' ' + r(y, 1) + ' ' + r(w, 1) + ' ' + r(h, 1));
    if (!this.svg.getAttribute('preserveAspectRatio')) {
      this.svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }
    if (this.style.bg && this.style.bg !== 'transparent') {
      var bgRect = el('rect', { x: x, y: y, width: w, height: h, fill: this.style.bg });
      this.svg.insertBefore(bgRect, this.defs.nextSibling);
    }
    return this.svg;
  };

  /* ==========================================================================
   * VIEW — an inch->pixel mapped sub-region of a Drawing
   * --------------------------------------------------------------------------
   * A View owns a scale (px per inch), a pixel origin, and a y-flip (so +y in
   * world inches points UP in elevation drawings, the engineering convention).
   * Primitives are written against a View so they can be authored in real-world
   * inches. Multiple Views in one Drawing let us place elevation + section side
   * by side at independent scales while sharing one viewBox.
   * ========================================================================*/

  /**
   * @param {Drawing} dwg
   * @param {Object} cfg
   * @param {number} cfg.scale  pixels per inch
   * @param {number} cfg.ox     pixel x of world origin (world x=0)
   * @param {number} cfg.oy     pixel y of world origin (world y=0)
   * @param {boolean} [cfg.flipY=true] world +y points up
   * @constructor
   */
  function View(dwg, cfg) {
    this.dwg = dwg;
    this.style = dwg.style;
    this.scale = cfg.scale;
    this.ox = cfg.ox;
    this.oy = cfg.oy;
    this.flipY = cfg.flipY !== false;
  }
  /** World x (in) -> pixel x. @param {number} xi @returns {number} */
  View.prototype.px = function (xi) { return this.ox + xi * this.scale; };
  /** World y (in) -> pixel y. @param {number} yi @returns {number} */
  View.prototype.py = function (yi) {
    return this.flipY ? (this.oy - yi * this.scale) : (this.oy + yi * this.scale);
  };
  /** Scale a length in inches to pixels. @param {number} li @returns {number} */
  View.prototype.s = function (li) { return li * this.scale; };
  /** Add a node to a layer (delegates to the Drawing). */
  View.prototype.add = function (node, layer) { return this.dwg.add(node, layer); };
  /** Extend the Drawing bbox by a pixel point. */
  View.prototype.mark = function (xpx, ypx) { this.dwg.extend(xpx, ypx); };

  /* ==========================================================================
   * PRIMITIVES — steel members
   * ========================================================================*/

  /**
   * Draw a W-shape CROSS-SECTION (looking down the member axis): the familiar
   * I profile, optionally hatched. Centered on world (cx, cy).
   * @param {View} v
   * @param {number} cx world x of centroid (in)
   * @param {number} cy world y of centroid (in)
   * @param {{d:number,bf:number,tf:number,tw:number}} g W geometry (inches)
   * @param {Object} [o]
   * @param {string} [o.fill]   profile fill (defaults to style.steelFill)
   * @param {boolean} [o.hatch=true] draw section hatching
   * @param {boolean} [o.highlight=false] use the primary-member fill
   * @returns {SVGElement} the path
   */
  function wSection(v, cx, cy, g, o) {
    o = o || {};
    var st = v.style;
    var d = g.d, bf = g.bf, tf = g.tf, tw = g.tw;
    var x0 = cx - bf / 2, x1 = cx + bf / 2;
    var iw = tw / 2; // half web
    var yT = cy + d / 2, yB = cy - d / 2;
    var yTi = yT - tf, yBi = yB + tf;
    // Build the I outline as a polygon path (clockwise from top-left).
    var pts = [
      [x0, yT], [x1, yT], [x1, yTi], [cx + iw, yTi], [cx + iw, yBi],
      [x1, yBi], [x1, yB], [x0, yB], [x0, yBi], [cx - iw, yBi],
      [cx - iw, yTi], [x0, yTi]
    ];
    var dStr = pathFromWorld(v, pts, true);
    var fill = o.fill || (o.highlight ? st.steelFillHi : st.steelFill);
    var p = el('path', { d: dStr, fill: fill, stroke: st.steel, 'stroke-width': st.lwObject, 'stroke-linejoin': 'round' });
    v.add(p, 'steel');
    if (o.hatch !== false) {
      var hp = el('path', { d: dStr, fill: 'url(#' + v.dwg.hatchPattern(st.hatch) + ')', stroke: 'none' });
      v.add(hp, 'steel');
    }
    markPts(v, pts);
    return p;
  }

  /**
   * Draw a W-shape ELEVATION (side view): a simple rectangle d tall x len long
   * with the two flanges shown as solid bands. Origin at the LEFT face,
   * vertically centered on cy.
   * @param {View} v
   * @param {number} xLeft world x of the left end (in)
   * @param {number} cy world y of the beam centroid (in)
   * @param {number} len member length drawn (in)
   * @param {{d:number,tf:number}} g
   * @param {Object} [o]
   * @param {boolean} [o.highlight=false]
   * @param {string} [o.fill]
   * @returns {SVGElement}
   */
  function wElevation(v, xLeft, cy, len, g, o) {
    o = o || {};
    var st = v.style;
    var d = g.d, tf = g.tf;
    var yT = cy + d / 2, yB = cy - d / 2;
    var fill = o.fill || (o.highlight ? st.steelFillHi : st.steelFill);
    var body = rectWorld(v, xLeft, yB, len, d, { fill: fill, stroke: st.steel, sw: st.lwObject });
    v.add(body, 'steel');
    // Flange bands (solid steel color).
    v.add(rectWorld(v, xLeft, yT - tf, len, tf, { fill: st.steel, stroke: 'none' }), 'steel');
    v.add(rectWorld(v, xLeft, yB, len, tf, { fill: st.steel, stroke: 'none' }), 'steel');
    markPts(v, [[xLeft, yB], [xLeft + len, yT]]);
    return body;
  }

  /**
   * Draw a rectangular/square HSS CROSS-SECTION (tube) centered on (cx, cy).
   * @param {View} v
   * @param {number} cx
   * @param {number} cy
   * @param {{H:number,B:number,t:number}} g  H=depth, B=width, t=design wall
   * @param {Object} [o]
   * @param {boolean} [o.highlight=false]
   * @param {boolean} [o.hatch=true]
   * @param {string} [o.fill]
   * @returns {SVGElement} outer rect
   */
  function rectHSSSection(v, cx, cy, g, o) {
    o = o || {};
    var st = v.style;
    var H = g.H, B = g.B, t = g.t;
    var fill = o.fill || (o.highlight ? st.steelFillHi : st.steelFill);
    var outer = rectWorld(v, cx - B / 2, cy - H / 2, B, H, { fill: fill, stroke: st.steel, sw: st.lwObject });
    v.add(outer, 'steel');
    if (o.hatch !== false) {
      v.add(rectWorld(v, cx - B / 2, cy - H / 2, B, H,
        { fill: 'url(#' + v.dwg.hatchPattern(st.hatch) + ')', stroke: 'none' }), 'steel');
    }
    // Inner void (clears hatch, shows wall thickness).
    v.add(rectWorld(v, cx - B / 2 + t, cy - H / 2 + t, B - 2 * t, H - 2 * t,
      { fill: st.steelFill === fill ? '#ffffff' : '#ffffff', stroke: st.steel, sw: st.lwObjectThin }), 'steel');
    markPts(v, [[cx - B / 2, cy - H / 2], [cx + B / 2, cy + H / 2]]);
    return outer;
  }

  /**
   * Draw a round HSS / pipe CROSS-SECTION (annulus) centered on (cx, cy).
   * @param {View} v
   * @param {number} cx
   * @param {number} cy
   * @param {{OD:number,t:number}} g
   * @param {Object} [o]
   * @returns {SVGElement} outer circle
   */
  function roundHSSSection(v, cx, cy, g, o) {
    o = o || {};
    var st = v.style;
    var R = g.OD / 2, t = g.t;
    var fill = o.fill || (o.highlight ? st.steelFillHi : st.steelFill);
    var cxp = v.px(cx), cyp = v.py(cy), Rp = v.s(R);
    var outer = el('circle', { cx: cxp, cy: cyp, r: Rp, fill: fill, stroke: st.steel, 'stroke-width': st.lwObject });
    v.add(outer, 'steel');
    if (o.hatch !== false) {
      v.add(el('circle', { cx: cxp, cy: cyp, r: Rp, fill: 'url(#' + v.dwg.hatchPattern(st.hatch) + ')', stroke: 'none' }), 'steel');
    }
    v.add(el('circle', { cx: cxp, cy: cyp, r: v.s(R - t), fill: '#ffffff', stroke: st.steel, 'stroke-width': st.lwObjectThin }), 'steel');
    markPts(v, [[cx - R, cy - R], [cx + R, cy + R]]);
    return outer;
  }

  /**
   * Draw a rectangular HSS / tube ELEVATION (side view) as a single outlined
   * band, hatch optional. Left face at xLeft, centered on cy.
   * @param {View} v
   * @param {number} xLeft
   * @param {number} cy
   * @param {number} len
   * @param {number} depth member depth shown (in)
   * @param {Object} [o]
   * @returns {SVGElement}
   */
  function tubeElevation(v, xLeft, cy, len, depth, o) {
    o = o || {};
    var st = v.style;
    var fill = o.fill || (o.highlight ? st.steelFillHi : st.steelFill);
    var rect = rectWorld(v, xLeft, cy - depth / 2, len, depth, { fill: fill, stroke: st.steel, sw: st.lwObject });
    v.add(rect, 'steel');
    if (o.hatch) {
      v.add(rectWorld(v, xLeft, cy - depth / 2, len, depth,
        { fill: 'url(#' + v.dwg.hatchPattern(st.hatch) + ')', stroke: 'none' }), 'steel');
    }
    markPts(v, [[xLeft, cy - depth / 2], [xLeft + len, cy + depth / 2]]);
    return rect;
  }

  /**
   * Draw a flat PLATE in elevation/plan: a filled, outlined rectangle in world
   * inches. Origin is the lower-left corner.
   * @param {View} v
   * @param {number} x lower-left world x (in)
   * @param {number} y lower-left world y (in)
   * @param {number} w width (in)
   * @param {number} h height (in)
   * @param {Object} [o]
   * @param {string} [o.fill]
   * @param {boolean} [o.highlight=false]
   * @param {boolean} [o.hatch=false]
   * @returns {SVGElement}
   */
  function plate(v, x, y, w, h, o) {
    o = o || {};
    var st = v.style;
    var fill = o.fill || (o.highlight ? st.steelFillHi : st.steelFill);
    var rect = rectWorld(v, x, y, w, h, { fill: fill, stroke: st.steel, sw: st.lwObject });
    v.add(rect, 'steel');
    if (o.hatch) {
      v.add(rectWorld(v, x, y, w, h, { fill: 'url(#' + v.dwg.hatchPattern(st.hatch) + ')', stroke: 'none' }), 'steel');
    }
    markPts(v, [[x, y], [x + w, y + h]]);
    return rect;
  }

  /* ==========================================================================
   * PRIMITIVES — bolts / anchors / centerlines / welds
   * ========================================================================*/

  /**
   * Draw a single bolt/anchor mark (circle + optional cross) at world (x,y).
   * @param {View} v
   * @param {number} x
   * @param {number} y
   * @param {number} dia bolt diameter (in)
   * @param {Object} [o]
   * @param {string} [o.color]
   * @param {boolean} [o.cross=true] draw centering cross
   * @returns {SVGElement} circle
   */
  function bolt(v, x, y, dia, o) {
    o = o || {};
    var st = v.style;
    var color = o.color || st.steel;
    var cxp = v.px(x), cyp = v.py(y), rp = Math.max(v.s(dia / 2), 2.2);
    var c = el('circle', { cx: cxp, cy: cyp, r: rp, fill: '#ffffff', stroke: color, 'stroke-width': st.lwObjectThin });
    v.add(c, 'steel');
    if (o.cross !== false) {
      var cr = rp + 1.6;
      v.add(el('line', { x1: cxp - cr, y1: cyp, x2: cxp + cr, y2: cyp, stroke: color, 'stroke-width': 0.6 }), 'steel');
      v.add(el('line', { x1: cxp, y1: cyp - cr, x2: cxp, y2: cyp + cr, stroke: color, 'stroke-width': 0.6 }), 'steel');
    }
    markPts(v, [[x - dia, y - dia], [x + dia, y + dia]]);
    return c;
  }

  /**
   * Draw a rectangular bolt/anchor PATTERN: nx by ny grid centered on (cx,cy)
   * at the given gauges, returning the world-space hole coordinates.
   * @param {View} v
   * @param {number} cx pattern center x (in)
   * @param {number} cy pattern center y (in)
   * @param {Object} cfg
   * @param {number} [cfg.nx=2] columns
   * @param {number} [cfg.ny=2] rows
   * @param {number} cfg.gx column spacing / gauge (in)
   * @param {number} cfg.gy row spacing (in)
   * @param {number} cfg.dia bolt dia (in)
   * @param {Object} [o] passed to bolt()
   * @returns {Array<{x:number,y:number}>} hole centers (world in)
   */
  function boltPattern(v, cx, cy, cfg, o) {
    var nx = cfg.nx || 2, ny = cfg.ny || 2;
    var gx = cfg.gx, gy = cfg.gy, dia = cfg.dia;
    var holes = [];
    var x0 = cx - gx * (nx - 1) / 2;
    var y0 = cy - gy * (ny - 1) / 2;
    for (var i = 0; i < nx; i++) {
      for (var j = 0; j < ny; j++) {
        var hx = x0 + i * gx, hy = y0 + j * gy;
        bolt(v, hx, hy, dia, o);
        holes.push({ x: hx, y: hy });
      }
    }
    return holes;
  }

  /**
   * Draw a centerline (long-short dash) between two world points.
   * @param {View} v
   * @param {number} x1
   * @param {number} y1
   * @param {number} x2
   * @param {number} y2
   * @returns {SVGElement}
   */
  function centerline(v, x1, y1, x2, y2) {
    var st = v.style;
    var ln = el('line', {
      x1: v.px(x1), y1: v.py(y1), x2: v.px(x2), y2: v.py(y2),
      stroke: st.center, 'stroke-width': st.lwCenter, 'stroke-dasharray': '7 2 1.5 2'
    });
    v.add(ln, 'center');
    return ln;
  }

  /**
   * Draw a fillet WELD symbol: a run of small triangular marks along an edge
   * plus an AWS-style leader+flag tag.
   * @param {View} v
   * @param {number} x1 weld start (world in)
   * @param {number} y1
   * @param {number} x2 weld end (world in)
   * @param {number} y2
   * @param {Object} [o]
   * @param {string} [o.size]  weld-size text (e.g. '1/4') for the flag
   * @param {'up'|'down'|'left'|'right'} [o.side='up'] which side the triangle teeth point
   * @param {boolean} [o.tag=true] draw the AWS leader + fillet flag
   * @returns {SVGGElement}
   */
  function weldFillet(v, x1, y1, x2, y2, o) {
    o = o || {};
    var st = v.style;
    var g = el('g', { 'class': 'are-weld' });
    var ax1 = v.px(x1), ay1 = v.py(y1), ax2 = v.px(x2), ay2 = v.py(y2);
    var dx = ax2 - ax1, dy = ay2 - ay1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ux = dx / len, uy = dy / len;          // along-edge unit
    var nxu = -uy, nyu = ux;                    // normal unit
    var dir = o.side === 'down' ? -1 : (o.side === 'left' ? -1 : 1);
    var teeth = Math.max(2, Math.round(len / 9));
    var tl = 6; // tooth size px
    for (var i = 0; i < teeth; i++) {
      var t0 = (i + 0.12) / teeth, t1 = (i + 0.88) / teeth;
      var bx = ax1 + dx * t0, by = ay1 + dy * t0;
      var ex = ax1 + dx * t1, ey = ay1 + dy * t1;
      var apx = (bx + ex) / 2 + nxu * tl * dir, apy = (by + ey) / 2 + nyu * tl * dir;
      g.appendChild(el('path', {
        d: 'M' + r(bx) + ',' + r(by) + ' L' + r(ex) + ',' + r(ey) + ' L' + r(apx) + ',' + r(apy) + ' z',
        fill: 'none', stroke: st.weld, 'stroke-width': 1
      }));
    }
    if (o.tag !== false) {
      // Leader from edge midpoint out to a reference line + fillet flag.
      var mxp = (ax1 + ax2) / 2 + nxu * tl * dir * 1.4;
      var myp = (ay1 + ay2) / 2 + nyu * tl * dir * 1.4;
      var refLen = 42, lead = 20;
      var rx = mxp + (dir > 0 ? 0 : 0) + 18, ry = myp - (dir > 0 ? 22 : -22);
      g.appendChild(el('line', { x1: mxp, y1: myp, x2: rx, y2: ry, stroke: st.weld, 'stroke-width': 0.9 }));
      g.appendChild(el('line', { x1: rx, y1: ry, x2: rx + refLen, y2: ry, stroke: st.weld, 'stroke-width': 0.9 }));
      // Fillet triangle flag on the reference line.
      g.appendChild(el('path', {
        d: 'M' + r(rx + 6) + ',' + r(ry) + ' L' + r(rx + 6) + ',' + r(ry - 9) + ' L' + r(rx + 15) + ',' + r(ry) + ' z',
        fill: st.weld, stroke: 'none'
      }));
      if (o.size) {
        var t = el('text', {
          x: rx + 18, y: ry - 2, fill: st.weld,
          'font-size': st.fsDim, 'font-family': st.font
        });
        t.textContent = o.size;
        g.appendChild(t);
      }
      v.dwg.extend(rx + refLen + 6, ry - 12); v.dwg.extend(mxp, myp + 4);
    }
    v.add(g, 'weld');
    return g;
  }

  /* ==========================================================================
   * PRIMITIVES — annotations (dimensions, leaders, forces, moments)
   * ========================================================================*/

  /**
   * Draw a linear DIMENSION line between two world points, offset perpendicular
   * by `off` pixels, with extension lines, arrowheads, and a centered value
   * label. Handles horizontal and vertical dims (and any angle).
   * @param {View} v
   * @param {number} x1 world x of first witness point
   * @param {number} y1 world y of first witness point
   * @param {number} x2 world x of second witness point
   * @param {number} y2 world y of second witness point
   * @param {string} label dimension text (already formatted, e.g. '10"')
   * @param {Object} [o]
   * @param {number} [o.off=22] perpendicular offset in PIXELS (sign picks side)
   * @param {string} [o.color] override (defaults to style.dim)
   * @returns {SVGGElement}
   */
  function dimLine(v, x1, y1, x2, y2, label, o) {
    o = o || {};
    var st = v.style;
    var color = o.color || st.dim;
    var off = o.off != null ? o.off : 22;
    var ax1 = v.px(x1), ay1 = v.py(y1), ax2 = v.px(x2), ay2 = v.py(y2);
    var dx = ax2 - ax1, dy = ay2 - ay1;
    var len = Math.sqrt(dx * dx + dy * dy) || 1;
    var nxu = -dy / len, nyu = dx / len;       // perpendicular unit (px)
    var ox = nxu * off, oy = nyu * off;
    var bx1 = ax1 + ox, by1 = ay1 + oy, bx2 = ax2 + ox, by2 = ay2 + oy;
    var g = el('g', { 'class': 'are-dim' });
    // Extension lines (witness): from object point to just past the dim line.
    var ext = 4;
    g.appendChild(el('line', { x1: ax1, y1: ay1, x2: bx1 + nxu * ext, y2: by1 + nyu * ext, stroke: color, 'stroke-width': 0.7 }));
    g.appendChild(el('line', { x1: ax2, y1: ay2, x2: bx2 + nxu * ext, y2: by2 + nyu * ext, stroke: color, 'stroke-width': 0.7 }));
    // Dimension line with arrowheads both ends.
    g.appendChild(el('line', {
      x1: bx1, y1: by1, x2: bx2, y2: by2, stroke: color, 'stroke-width': st.lwDim,
      'marker-start': 'url(#areArrDim)', 'marker-end': 'url(#areArrDim)'
    }));
    // Label centered, nudged off the line.
    var mx = (bx1 + bx2) / 2 + nxu * 9, my = (by1 + by2) / 2 + nyu * 9;
    var horizontalish = Math.abs(dx) >= Math.abs(dy);
    var t = el('text', {
      x: r(mx), y: r(my + (horizontalish ? 0 : 3)), fill: color,
      'font-size': st.fsDim, 'font-family': st.font, 'text-anchor': 'middle',
      'dominant-baseline': horizontalish ? 'middle' : 'auto'
    });
    t.textContent = label;
    g.appendChild(t);
    v.add(g, 'anno');
    v.dwg.extend(mx, my); v.dwg.extend(bx1, by1); v.dwg.extend(bx2, by2);
    return g;
  }

  /**
   * Draw a LEADER callout: a kinked leader line from a target world point to a
   * text label, with a small dot at the target.
   * @param {View} v
   * @param {number} tx target world x
   * @param {number} ty target world y
   * @param {number} lx label pixel-offset x from target (px)
   * @param {number} ly label pixel-offset y from target (px)
   * @param {string} label
   * @param {Object} [o]
   * @param {string} [o.color]
   * @param {string} [o.anchor='start'] text-anchor
   * @returns {SVGGElement}
   */
  function leader(v, tx, ty, lx, ly, label, o) {
    o = o || {};
    var st = v.style;
    var color = o.color || st.dim;
    var px0 = v.px(tx), py0 = v.py(ty);
    var ex = px0 + lx, ey = py0 + ly;
    var elbX = ex - (lx > 0 ? 10 : -10);
    var g = el('g', { 'class': 'are-leader' });
    g.appendChild(el('circle', { cx: px0, cy: py0, r: 1.6, fill: color }));
    g.appendChild(el('polyline', {
      points: r(px0) + ',' + r(py0) + ' ' + r(elbX) + ',' + r(ey) + ' ' + r(ex) + ',' + r(ey),
      fill: 'none', stroke: color, 'stroke-width': 0.9
    }));
    var t = el('text', {
      x: r(ex + (lx > 0 ? 3 : -3)), y: r(ey - 3), fill: color,
      'font-size': st.fsLabel, 'font-family': st.font,
      'text-anchor': o.anchor || (lx > 0 ? 'start' : 'end')
    });
    t.textContent = label;
    g.appendChild(t);
    v.add(g, 'anno');
    v.dwg.extend(ex + (lx > 0 ? 40 : -40), ey - 12); v.dwg.extend(ex, ey + 6);
    return g;
  }

  /**
   * Draw a straight FORCE arrow (point load / axial / flange force) from a tail
   * world point along (dirX, dirY) for `lenPx` pixels, with a value label.
   * @param {View} v
   * @param {number} x tail world x
   * @param {number} y tail world y
   * @param {number} dirX direction x component (world sense; sign only matters)
   * @param {number} dirY direction y component
   * @param {number} lenPx arrow length in PIXELS
   * @param {string} label formatted value
   * @param {Object} [o]
   * @param {string} [o.color]
   * @param {boolean} [o.headAtTail=false] put arrowhead at the tail end instead
   * @param {number} [o.labelOff=8] label offset from the arrow (px)
   * @returns {SVGGElement}
   */
  function forceArrow(v, x, y, dirX, dirY, lenPx, label, o) {
    o = o || {};
    var st = v.style;
    var color = o.color || st.force;
    var px0 = v.px(x), py0 = v.py(y);
    // Convert a world-direction to a pixel-direction (py is flipped).
    var dpx = dirX, dpy = v.flipY ? -dirY : dirY;
    var dl = Math.sqrt(dpx * dpx + dpy * dpy) || 1;
    var ux = dpx / dl, uy = dpy / dl;
    var hx = px0 + ux * lenPx, hy = py0 + uy * lenPx;
    var g = el('g', { 'class': 'are-force' });
    g.appendChild(el('line', {
      x1: r(px0), y1: r(py0), x2: r(hx), y2: r(hy),
      stroke: color, 'stroke-width': st.lwForce,
      'marker-end': o.headAtTail ? null : 'url(#areArrForce)',
      'marker-start': o.headAtTail ? 'url(#areArrForce)' : null
    }));
    if (label) {
      var lo = o.labelOff != null ? o.labelOff : 8;
      var mxp = (px0 + hx) / 2 - uy * lo, myp = (py0 + hy) / 2 + ux * lo;
      var t = el('text', {
        x: r(mxp), y: r(myp), fill: color, 'font-size': st.fsForce,
        'font-family': st.font, 'font-weight': 600, 'text-anchor': 'middle'
      });
      t.textContent = label;
      g.appendChild(t);
      v.dwg.extend(mxp, myp - 8); v.dwg.extend(mxp + label.length * 4, myp + 4);
    }
    v.add(g, 'anno');
    v.dwg.extend(hx, hy); v.dwg.extend(px0, py0);
    return g;
  }

  /**
   * Draw a DISTRIBUTED load (UDL): a row of short down-arrows under a top rail
   * spanning [x1,x2] at world height y, with a centered w-label.
   * @param {View} v
   * @param {number} x1 world x start
   * @param {number} x2 world x end
   * @param {number} y world y of the loaded edge
   * @param {number} hPx rail height above the member (px)
   * @param {string} label e.g. 'w = 2.4 k/ft'
   * @param {Object} [o]
   * @returns {SVGGElement}
   */
  function distLoad(v, x1, x2, y, hPx, label, o) {
    o = o || {};
    var st = v.style;
    var color = o.color || st.force;
    var ay = v.py(y);
    var railY = ay - hPx;
    var ax1 = v.px(x1), ax2 = v.px(x2);
    var g = el('g', { 'class': 'are-udl' });
    g.appendChild(el('line', { x1: ax1, y1: railY, x2: ax2, y2: railY, stroke: color, 'stroke-width': st.lwDim }));
    var n = Math.max(3, Math.round((ax2 - ax1) / 26));
    for (var i = 0; i <= n; i++) {
      var ax = ax1 + (ax2 - ax1) * i / n;
      g.appendChild(el('line', { x1: ax, y1: railY, x2: ax, y2: ay - 1, stroke: color, 'stroke-width': st.lwDim, 'marker-end': 'url(#areArrForce)' }));
    }
    if (label) {
      var t = el('text', { x: (ax1 + ax2) / 2, y: railY - 5, fill: color, 'font-size': st.fsForce, 'font-family': st.font, 'font-weight': 600, 'text-anchor': 'middle' });
      t.textContent = label;
      g.appendChild(t);
    }
    v.add(g, 'anno');
    v.dwg.extend(ax1, railY - 14); v.dwg.extend(ax2, ay);
    return g;
  }

  /**
   * Draw a curved MOMENT arrow at world (cx, cy): a ~270-degree arc with a head,
   * plus a value label.
   * @param {View} v
   * @param {number} cx world x
   * @param {number} cy world y
   * @param {number} rPx arc radius (px)
   * @param {string} label formatted moment
   * @param {Object} [o]
   * @param {boolean} [o.ccw=true] counter-clockwise (positive) sense
   * @param {string} [o.color]
   * @param {number} [o.labelDy=-6] label vertical nudge (px)
   * @returns {SVGGElement}
   */
  function momentArrow(v, cx, cy, rPx, label, o) {
    o = o || {};
    var st = v.style;
    var color = o.color || st.moment;
    var cxp = v.px(cx), cyp = v.py(cy);
    var ccw = o.ccw !== false;
    // Sweep ~280 degrees. Start/end angles in screen space.
    var a0 = ccw ? 130 : 50, a1 = ccw ? -150 : 230;
    var p0 = polar(cxp, cyp, rPx, a0), p1 = polar(cxp, cyp, rPx, a1);
    var large = 1, sweep = ccw ? 0 : 1;
    var g = el('g', { 'class': 'are-moment' });
    g.appendChild(el('path', {
      d: 'M' + r(p0.x) + ',' + r(p0.y) + ' A' + r(rPx) + ',' + r(rPx) + ' 0 ' + large + ' ' + sweep + ' ' + r(p1.x) + ',' + r(p1.y),
      fill: 'none', stroke: color, 'stroke-width': st.lwForce, 'marker-end': 'url(#areArrMoment)'
    }));
    if (label) {
      var t = el('text', {
        x: cxp, y: cyp + (o.labelDy != null ? o.labelDy : -6), fill: color,
        'font-size': st.fsForce, 'font-family': st.font, 'font-weight': 600, 'text-anchor': 'middle'
      });
      t.textContent = label;
      g.appendChild(t);
    }
    v.add(g, 'anno');
    v.dwg.extend(cxp - rPx - 6, cyp - rPx - 12); v.dwg.extend(cxp + rPx + 6, cyp + rPx + 6);
    return g;
  }

  /**
   * Draw a view TITLE centered above a pixel-x at a pixel-y.
   * @param {View} v
   * @param {number} xpx pixel x
   * @param {number} ypx pixel y
   * @param {string} str
   * @returns {SVGElement}
   */
  function viewTitle(v, xpx, ypx, str) {
    var st = v.style;
    var t = el('text', {
      x: r(xpx), y: r(ypx), fill: st.title, 'font-size': st.fsTitle,
      'font-family': st.font, 'font-weight': 700, 'text-anchor': 'middle'
    });
    t.textContent = str;
    v.add(t, 'anno');
    v.dwg.extend(xpx, ypx - st.fsTitle);
    return t;
  }

  /**
   * Draw a plain member LABEL (e.g. the section name) centered at a world point.
   * @param {View} v
   * @param {number} x world x
   * @param {number} y world y
   * @param {string} str
   * @param {Object} [o]
   * @returns {SVGElement}
   */
  function memberLabel(v, x, y, str, o) {
    o = o || {};
    var st = v.style;
    var t = el('text', {
      x: r(v.px(x)), y: r(v.py(y)), fill: o.color || st.steel, 'font-size': o.size || st.fsLabel,
      'font-family': st.font, 'font-weight': o.weight || 700,
      'text-anchor': o.anchor || 'middle', 'dominant-baseline': 'middle'
    });
    t.textContent = str;
    v.add(t, 'anno');
    v.dwg.extend(v.px(x), v.py(y));
    return t;
  }

  /* ==========================================================================
   * SHARED GEOMETRY HELPERS (world<->pixel rect / path / polar)
   * ========================================================================*/

  /** Build a world-space rect as an SVG <rect> in pixel space. @private */
  function rectWorld(v, x, y, w, h, o) {
    var p1x = v.px(x), p1y = v.py(y), p2x = v.px(x + w), p2y = v.py(y + h);
    return el('rect', {
      x: r(Math.min(p1x, p2x)), y: r(Math.min(p1y, p2y)),
      width: r(Math.abs(p2x - p1x)), height: r(Math.abs(p2y - p1y)),
      fill: o.fill, stroke: o.stroke, 'stroke-width': o.sw, 'stroke-linejoin': 'round'
    });
  }

  /** Build an SVG path "d" from a list of [worldX, worldY] points. @private */
  function pathFromWorld(v, pts, close) {
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      d += (i === 0 ? 'M' : 'L') + r(v.px(pts[i][0])) + ',' + r(v.py(pts[i][1])) + ' ';
    }
    if (close) d += 'Z';
    return d.trim();
  }

  /** Extend the Drawing bbox by a list of world points. @private */
  function markPts(v, pts) {
    for (var i = 0; i < pts.length; i++) v.dwg.extend(v.px(pts[i][0]), v.py(pts[i][1]));
  }

  /** Polar offset in PIXEL space (angle degrees, screen y-down). @private */
  function polar(cx, cy, rad, angDeg) {
    var a = angDeg * Math.PI / 180;
    return { x: cx + rad * Math.cos(a), y: cy - rad * Math.sin(a) };
  }

  /* ==========================================================================
   * SCALE / LAYOUT HELPERS
   * ========================================================================*/

  /**
   * Choose a px-per-inch scale so a real-world extent (in) fits a pixel budget,
   * clamped to a sane range so tiny members aren't microscopic and huge ones
   * don't overflow.
   * @param {number} worldExtent the largest dimension to show (in)
   * @param {number} pxBudget target pixels for that extent
   * @param {Object} [o]
   * @param {number} [o.min=1.5] min px/in
   * @param {number} [o.max=18] max px/in
   * @returns {number} px per inch
   */
  function fitScale(worldExtent, pxBudget, o) {
    o = o || {};
    var s = pxBudget / Math.max(worldExtent, 0.001);
    return Math.max(o.min != null ? o.min : 1.5, Math.min(o.max != null ? o.max : 18, s));
  }

  /* ==========================================================================
   * HIGH-LEVEL RENDERERS
   * ========================================================================*/

  /**
   * Dispatch a Calc State to the correct connection renderer.
   * @param {SVGSVGElement} svg target <svg> element
   * @param {Object} state Calc State (see docs/calc-state-spec.md)
   * @param {Object} [options]
   * @param {Object<string,Object>} [options.resolvedGeometry] label->geometry
   * @param {boolean} [options.dark]
   * @param {AREDrawStyle} [options.style]
   * @returns {SVGSVGElement}
   */
  function renderConnection(svg, state, options) {
    options = options || {};
    switch (state && state.calcType) {
      case 'w-to-hss-column': return renderWToHss(svg, state, options);
      case 'base-plate': return renderBasePlate(svg, state, options);
      case 'hss-to-hss-branch': return renderHssToHss(svg, state, options);
      default: return renderUnknown(svg, state, options);
    }
  }

  /** Build a Drawing for a renderer with resolved style. @private */
  function newDrawing(svg, options) {
    var style = resolveStyle(options);
    return { dwg: new Drawing(svg, { style: style }), style: style };
  }

  /* ----- w-to-hss-column -------------------------------------------------- */

  /**
   * Render a directly-welded W-beam to HSS-column moment connection: an
   * ELEVATION (beam framing into the column face, flange-force couple + moment
   * shown) plus the HSS COLUMN CROSS-SECTION with the beam flange width band.
   * Per spec §3.1 this is a direct flange-couple check (no shear tab, no bolts).
   * @param {SVGSVGElement} svg
   * @param {Object} state
   * @param {Object} [options]
   * @returns {SVGSVGElement}
   */
  function renderWToHss(svg, state, options) {
    var ctx = newDrawing(svg, options), dwg = ctx.dwg, st = ctx.style;
    var res = (options && options.resolvedGeometry) || {};
    var beam = resolveSection(state.member.section, res);
    var colSec = state.connection && state.connection.column ? state.connection.column.section : null;
    var col = resolveSection(colSec, res);
    if (col.kind === 'roundHSS') col = { kind: 'rectHSS', H: col.OD, B: col.OD, t: col.t, _fallback: col._fallback };

    var Mu = state.demands ? state.demands.Mu : null;          // kip-ft
    var beamLbl = state.member.section || 'W-Beam';
    var colLbl = colSec || 'HSS Column';
    // Flange-couple force Puf = Mu*12 / (d - tf)  [spec §3.1]
    var Puf = (Mu != null && beam.kind === 'W' && beam.d) ? (Mu * 12 / (beam.d - beam.tf)) : null;

    // ---- ELEVATION view (left) ----
    var elevScale = fitScale(Math.max(col.H, beam.d) * 1.2, 150, { min: 2.5, max: 13 });
    var colTopIn = Math.max(col.H, beam.d) * 0.85 + 6;
    var colBotIn = -(Math.max(col.H, beam.d) * 0.85 + 6);
    var vE = new View(dwg, { scale: elevScale, ox: 70, oy: 165, flipY: true });
    viewTitle(vE, vE.px(col.B / 2), vE.py(colTopIn) - 12, 'Elevation');

    // HSS column (vertical) drawn as a tube elevation centered on world x=0.
    tubeElevation(vE, -col.B / 2, (colTopIn + colBotIn) / 2, col.B, (colTopIn - colBotIn),
      { fill: st.steelFill, hatch: false });
    // Re-draw as proper vertical tube: outline + inner wall lines.
    vE.add(rectWorld(vE, -col.B / 2 + col.t, colBotIn, col.B - 2 * col.t, (colTopIn - colBotIn),
      { fill: 'none', stroke: st.steel, sw: st.lwObjectThin }), 'steel');
    memberLabel(vE, 0, colBotIn - 1.4, colLbl, { size: st.fsLabel });

    // Beam framing into the right column face (world x from B/2 outward).
    var beamLen = (col.B / 2) + Math.max(beam.d * 1.9, 16);
    wElevation(vE, col.B / 2, 0, beamLen - col.B / 2, beam, { highlight: true });
    memberLabel(vE, (col.B / 2 + beamLen) / 2 + 1, 0, beamLbl, { size: st.fsLabel });
    centerline(vE, col.B / 2, 0, beamLen + 2, 0);

    // Weld at the beam-to-column interface (top + bottom flange).
    weldFillet(vE, col.B / 2, beam.d / 2, col.B / 2, beam.d / 2 - beam.tf, { size: '5/16', side: 'left', tag: false });
    weldFillet(vE, col.B / 2, -beam.d / 2 + beam.tf, col.B / 2, -beam.d / 2, { size: '5/16', side: 'left', tag: false });

    // Flange-force couple arrows (top = compression into column, bottom = tension out).
    var fLbl = Puf != null ? ('Puf = ' + fmtKip(Math.abs(Puf))) : 'Puf';
    forceArrow(vE, col.B / 2 + beam.d * 1.1, beam.d / 2 - beam.tf / 2, -1, 0, 46, fLbl, { color: st.force });
    forceArrow(vE, col.B / 2 + beam.d * 0.4, -beam.d / 2 + beam.tf / 2, 1, 0, 46, '(T)', { color: st.force, labelOff: -10 });
    // Applied moment arc near the beam free end.
    momentArrow(vE, beamLen - beam.d * 0.5, 0, Math.min(vE.s(beam.d) * 0.42, 24),
      Mu != null ? ('Mu = ' + fmtKft(Mu)) : 'Mu', { ccw: true, color: st.moment, labelDy: -vE.s(beam.d) * 0.5 - 8 });

    // Beam depth dimension.
    dimLine(vE, beamLen, -beam.d / 2, beamLen, beam.d / 2, fmtIn(beam.d), { off: 26 });

    // ---- HSS COLUMN SECTION view (right) ----
    var secScale = fitScale(col.B * 1.5, 120, { min: 4, max: 16 });
    var secCx = 1; // placed via ox below
    var sectionOx = vE.px(beamLen) + 150;
    var vS = new View(dwg, { scale: secScale, ox: sectionOx, oy: 150, flipY: true });
    viewTitle(vS, vS.px(0), vS.py(col.H / 2) - 26, 'HSS Section');
    rectHSSSection(vS, 0, 0, col, { highlight: false });

    // Beam flange width band on the top face (bp = bf).
    var bandH = Math.max(col.B * 0.06, 0.25);
    plate(vS, -beam.bf / 2, col.H / 2, beam.bf, bandH, { highlight: true, hatch: false });
    leader(vS, 0, col.H / 2 + bandH, 30, -26, 'beam flange bf', { color: st.steel });

    // Dimensions: bp=bf (top inside), flat = B-3t, and B below.
    dimLine(vS, -beam.bf / 2, col.H / 2 - 0.6, beam.bf / 2, col.H / 2 - 0.6, 'bp = bf = ' + fmtIn(beam.bf), { off: -20 });
    var flat = col.B - 3 * col.t;
    dimLine(vS, -flat / 2, -col.H / 2 + 0.6, flat / 2, -col.H / 2 + 0.6, 'flat = B−3t = ' + fmtIn(flat), { off: 20 });
    dimLine(vS, -col.B / 2, -col.H / 2, col.B / 2, -col.H / 2, 'B = ' + fmtIn(col.B), { off: 26 });
    leader(vS, col.B / 2 - col.t / 2, 0, 34, 0, 't = ' + fmtIn(col.t), { color: st.dim });

    // Caption with the governing limit state if present.
    captionBox(dwg, st, state, 'AISC 360-22 §K1.3, Eq. K1-7 — HSS wall local yielding from flange couple');
    return dwg.commit();
  }

  /* ----- base-plate ------------------------------------------------------- */

  /**
   * Render a column base plate: a PLAN view (plate outline, anchor pattern,
   * column footprint) and an ELEVATION (plate on concrete with axial + moment +
   * shear demand arrows). Per spec §3.2.
   * @param {SVGSVGElement} svg
   * @param {Object} state
   * @param {Object} [options]
   * @returns {SVGSVGElement}
   */
  function renderBasePlate(svg, state, options) {
    var ctx = newDrawing(svg, options), dwg = ctx.dwg, st = ctx.style;
    var res = (options && options.resolvedGeometry) || {};
    var conn = state.connection || {};
    var pl = conn.plate || {}, an = conn.anchors || {}, cc = conn.concrete || {};
    var N = pl.N || 12, B = pl.B || 12, tp = pl.tp || 0.75;
    var col = resolveSection(state.member.section, res);
    var nAnch = an.n || 4, dia = an.dia || 0.75, gauge = an.gauge != null ? an.gauge : Math.min(N, B) - 3;

    var Pu = state.demands ? state.demands.Pu : null;
    var Mu = state.demands ? state.demands.Mu : null;  // kip-ft
    var Vu = state.demands ? state.demands.Vu : null;

    // ---- PLAN view ----
    var planScale = fitScale(Math.max(N, B) * 1.18, 150, { min: 3, max: 14 });
    var vP = new View(dwg, { scale: planScale, ox: 95, oy: 150, flipY: true });
    viewTitle(vP, vP.px(0), vP.py(N / 2) - 30, 'Plan');
    // Plate (centered on origin), N along y (depth), B along x (width).
    plate(vP, -B / 2, -N / 2, B, N, { highlight: true, hatch: false });

    // Column footprint at center.
    if (col.kind === 'W') {
      wSection(vP, 0, 0, col, { hatch: true, fill: st.steelFill });
    } else if (col.kind === 'roundHSS') {
      roundHSSSection(vP, 0, 0, col, { hatch: true, fill: st.steelFill });
    } else {
      rectHSSSection(vP, 0, 0, col, { hatch: true, fill: st.steelFill });
    }

    // Anchor pattern (assume rectangular: split count into nx x ny).
    var nx = nAnch <= 2 ? 1 : 2;
    var ny = Math.max(1, Math.round(nAnch / nx));
    var holes = boltPattern(vP, 0, 0, { nx: nx, ny: ny, gx: gauge, gy: gauge, dia: dia }, { color: st.steel });

    // Dimensions: B (bottom), N (left), gauge between anchors.
    dimLine(vP, -B / 2, -N / 2, B / 2, -N / 2, 'B = ' + fmtIn(B), { off: 28 });
    dimLine(vP, -B / 2, -N / 2, -B / 2, N / 2, 'N = ' + fmtIn(N), { off: -28 });
    if (nx > 1) {
      dimLine(vP, -gauge / 2, N / 2, gauge / 2, N / 2, 'sg = ' + fmtIn(gauge), { off: -18 });
    }
    leader(vP, holes[0].x, holes[0].y, -34, -22,
      nAnch + '–⌀' + fmtIn(dia) + ' ' + (an.grade || 'F1554'), { color: st.dim });

    // ---- ELEVATION view (right) ----
    var elScale = planScale;
    var elOx = vP.px(B / 2) + 150;
    var pedH = Math.max(N * 0.6, 6);
    var vE = new View(dwg, { scale: elScale, ox: elOx, oy: 150, flipY: true });
    viewTitle(vE, vE.px(0), vE.py(N / 2) - 30, 'Elevation');
    // Concrete pedestal block under the plate.
    plate(vE, -B / 2 - 1.2, -pedH, B + 2.4, pedH, { fill: '#eceae4', hatch: true });
    // Base plate (thin band on top of pedestal).
    plate(vE, -B / 2, 0, B, tp, { highlight: true, hatch: false });
    // Column stub on the plate.
    var colDepthEl = (col.kind === 'W') ? col.d : (col.kind === 'roundHSS' ? col.OD : col.H);
    var colWEl = (col.kind === 'W') ? col.bf : (col.kind === 'roundHSS' ? col.OD : col.B);
    var stubH = Math.max(N * 0.55, 5);
    plate(vE, -colWEl / 2, tp, colWEl, stubH, { fill: st.steelFill, hatch: false });
    // Anchors (down into concrete) at +/- gauge/2.
    var hef = cc.hef || 8;
    [-gauge / 2, gauge / 2].forEach(function (ax) {
      vE.add(el('line', { x1: vE.px(ax), y1: vE.py(tp), x2: vE.px(ax), y2: vE.py(-Math.min(hef, pedH - 0.5)), stroke: st.steel, 'stroke-width': st.lwObject }), 'steel');
      // Hook
      vE.add(el('line', { x1: vE.px(ax), y1: vE.py(-Math.min(hef, pedH - 0.5)), x2: vE.px(ax + (ax < 0 ? -0.8 : 0.8)), y2: vE.py(-Math.min(hef, pedH - 0.5)), stroke: st.steel, 'stroke-width': st.lwObject }), 'steel');
    });
    centerline(vE, 0, tp + stubH + 2, 0, -pedH - 2);

    // Demand arrows: axial Pu (down onto column top), moment Mu (arc), shear Vu.
    var topY = tp + stubH;
    if (Pu != null) forceArrow(vE, 0, topY + colDepthEl * 0.9, 0, -1, 40, 'Pu = ' + fmtKip(Pu), { color: st.force, labelOff: 12 });
    if (Mu != null && Mu !== 0) momentArrow(vE, 0, topY * 0.6 + tp, 16, 'Mu = ' + fmtKft(Mu), { ccw: true, color: st.moment, labelDy: -22 });
    if (Vu != null && Vu !== 0) forceArrow(vE, -colWEl / 2 - 1, topY * 0.5, 1, 0, 34, 'Vu = ' + fmtKip(Vu), { color: st.force, labelOff: -10 });

    // Plate thickness + embedment dims.
    dimLine(vE, B / 2, 0, B / 2, tp, 'tp = ' + fmtIn(tp), { off: 22 });
    dimLine(vE, gauge / 2 + 0.3, tp, gauge / 2 + 0.3, -Math.min(hef, pedH - 0.5), 'hef = ' + fmtIn(hef), { off: 24 });

    captionBox(dwg, st, state, 'AISC DG1 + ACI 318-19 Ch.17 — bearing, plate, anchor steel & concrete checks');
    return dwg.commit();
  }

  /* ----- hss-to-hss-branch ------------------------------------------------ */

  /**
   * Render an HSS branch-to-chord connection ELEVATION (branch at theta to the
   * chord) plus the relevant cross-section, honoring subType:
   *  - rect-moment  : rectangular branch on rectangular chord, moment+axial.
   *  - round-moment : round branch on round chord.
   *  - truss        : axial-only, K-gap topology when connType is K (gap shown).
   * Per spec §3.3.
   * @param {SVGSVGElement} svg
   * @param {Object} state
   * @param {Object} [options]
   * @returns {SVGSVGElement}
   */
  function renderHssToHss(svg, state, options) {
    var ctx = newDrawing(svg, options), dwg = ctx.dwg, st = ctx.style;
    var res = (options && options.resolvedGeometry) || {};
    var conn = state.connection || {};
    var subType = conn.subType || 'rect-moment';
    var connType = conn.connType || 'T';
    var theta = conn.theta != null ? conn.theta : 90;
    var round = subType === 'round-moment';

    var branch = resolveSection(state.member.section, res);
    var chord = resolveSection(conn.chord ? conn.chord.section : null, res);
    // Coerce kinds to match subType expectation for clean drawing.
    if (round && branch.kind !== 'roundHSS') branch = toRound(branch);
    if (round && chord.kind !== 'roundHSS') chord = toRound(chord);
    if (!round && branch.kind === 'roundHSS') branch = toRect(branch);
    if (!round && chord.kind === 'roundHSS') chord = toRect(chord);

    var chordDepth = round ? chord.OD : chord.H;
    var chordWidth = round ? chord.OD : chord.B;
    var branchDepth = round ? branch.OD : (conn.orient === 'B' ? branch.B : branch.H);
    var branchWidth = round ? branch.OD : (conn.orient === 'B' ? branch.H : branch.B);

    var Pu = state.demands ? state.demands.Pu : null;
    var Mu = state.demands ? state.demands.Mu : null;       // kip-IN here
    var Mu_op = state.demands ? state.demands.Mu_op : null; // kip-in
    var Vu = state.demands ? state.demands.Vu : null;

    var chordLbl = (conn.chord && conn.chord.section) || 'HSS Chord';
    var branchLbl = state.member.section || 'HSS Branch';

    // ---- ELEVATION ----
    var maxDim = Math.max(chordDepth, branchDepth * 2.6);
    var elScale = fitScale(maxDim * 1.3, 150, { min: 2.5, max: 13 });
    var chordLen = chordDepth * 5.5;
    var vE = new View(dwg, { scale: elScale, ox: 60, oy: 175, flipY: true });
    viewTitle(vE, vE.px(chordLen / 2 - chordLen / 2 + chordLen / 2), vE.py(chordDepth / 2) - 30,
      subType === 'truss' ? 'Truss Joint — ' + connType : 'Branch Connection — ' + connType + (theta !== 90 ? ' (θ=' + theta + '°)' : ''));

    // Chord runs horizontally along world x, centered on y=0.
    if (round) {
      tubeElevation(vE, 0, 0, chordLen, chordDepth, { fill: st.steelFill, hatch: false });
      vE.add(el('line', { x1: vE.px(0), y1: vE.py(0), x2: vE.px(chordLen), y2: vE.py(0), stroke: st.center, 'stroke-width': st.lwCenter, 'stroke-dasharray': '7 2 1.5 2' }), 'center');
    } else {
      tubeElevation(vE, 0, 0, chordLen, chordDepth, { fill: st.steelFill, hatch: false });
    }
    memberLabel(vE, chordLen * 0.5, -chordDepth / 2 - 1.3, chordLbl, { size: st.fsLabel });

    // Branch(es). For truss-K draw two diagonals; otherwise one branch at theta.
    var th = theta * Math.PI / 180;
    var bx0 = chordLen / 2; // branch lands at chord mid by default
    var bLen = branchDepth * 3.0;

    function drawBranch(footX, dir, lbl, hi) {
      // dir = +1 (theta from +x) or -1 (mirror) for K joints.
      var ang = dir > 0 ? th : (Math.PI - th);
      var topY = chordDepth / 2;
      var tipX = footX + Math.cos(ang) * bLen;
      var tipY = topY + Math.sin(ang) * bLen;
      // Branch as a rotated band: build 4 corners in world coords.
      var hw = branchWidth / 2;
      var perpX = -Math.sin(ang), perpY = Math.cos(ang);
      var c = [
        [footX + perpX * hw, topY + perpY * hw],
        [footX - perpX * hw, topY - perpY * hw],
        [tipX - perpX * hw, tipY - perpY * hw],
        [tipX + perpX * hw, tipY + perpY * hw]
      ];
      var p = el('path', { d: pathFromWorld(vE, c, true), fill: hi ? st.steelFillHi : st.steelFill, stroke: st.steel, 'stroke-width': st.lwObject, 'stroke-linejoin': 'round' });
      vE.add(p, 'steel');
      markPts(vE, c);
      // Weld at the footprint (along chord top edge under branch).
      weldFillet(vE, footX - hw, topY, footX + hw, topY, { size: round ? '3/16' : '1/4', side: 'up', tag: false });
      memberLabel(vE, (footX + tipX) / 2 + perpX * (hw + 1.4), (topY + tipY) / 2 + perpY * (hw + 1.4), lbl, { size: st.fsLabel, anchor: 'middle' });
      return { tipX: tipX, tipY: tipY, ang: ang, footX: footX };
    }

    if (subType === 'truss' && (connType === 'KG' || connType === 'KO')) {
      var gap = conn.gap != null ? conn.gap : chordDepth * 0.5;
      var b1 = drawBranch(bx0 - branchWidth / 2 - gap / 2, -1, branchLbl, true);
      var b2 = drawBranch(bx0 + branchWidth / 2 + gap / 2, 1, branchLbl, true);
      // Gap dimension between branch toes.
      dimLine(vE, b1.footX + branchWidth / 2, chordDepth / 2, b2.footX - branchWidth / 2, chordDepth / 2,
        'g = ' + fmtIn(gap), { off: -16 });
      if (Pu != null) {
        forceArrow(vE, b1.tipX, b1.tipY, Math.cos(b1.ang), Math.sin(b1.ang), 34, 'Pu = ' + fmtKip(Pu), { color: st.force });
        forceArrow(vE, b2.tipX, b2.tipY, Math.cos(b2.ang), Math.sin(b2.ang), 34, '', { color: st.force });
      }
    } else {
      var b = drawBranch(bx0, 1, branchLbl, true);
      // Branch width dim across the foot.
      dimLine(vE, bx0 - branchWidth / 2, chordDepth / 2, bx0 + branchWidth / 2, chordDepth / 2,
        (round ? 'Db = ' : 'Bb = ') + fmtIn(branchWidth), { off: 16, color: st.dim });
      // Demands on the branch: axial Pu (along branch), moment Mu (kip-in), shear Vu.
      if (Pu != null && Pu !== 0) forceArrow(vE, b.tipX, b.tipY, -Math.cos(b.ang), -Math.sin(b.ang), 38, 'Pu = ' + fmtKip(Pu), { color: st.force });
      if (Mu != null && Mu !== 0) momentArrow(vE, b.tipX - Math.cos(b.ang) * branchDepth * 0.2, b.tipY - Math.sin(b.ang) * branchDepth * 0.2, 16, 'Mu,ip = ' + fmtKin(Mu), { ccw: true, color: st.moment, labelDy: -20 });
      if (Vu != null && Vu !== 0) forceArrow(vE, b.footX + branchWidth / 2 + branchDepth * 0.3, (chordDepth / 2 + b.tipY) / 2, 0, -1, 28, 'Vu = ' + fmtKip(Vu), { color: st.force, labelOff: 14 });
      // Angle annotation if not 90.
      if (theta !== 90) {
        vE.add(el('path', {
          d: 'M' + r(vE.px(bx0 + chordDepth * 0.6)) + ',' + r(vE.py(chordDepth / 2)) +
            ' A' + r(vE.s(chordDepth * 0.6)) + ',' + r(vE.s(chordDepth * 0.6)) + ' 0 0 0 ' +
            r(vE.px(bx0 + Math.cos(th) * chordDepth * 0.6)) + ',' + r(vE.py(chordDepth / 2 + Math.sin(th) * chordDepth * 0.6)),
          fill: 'none', stroke: st.dim, 'stroke-width': 0.8
        }), 'anno');
        memberLabel(vE, bx0 + chordDepth * 0.85, chordDepth / 2 + chordDepth * 0.25, 'θ=' + theta + '°', { size: st.fsDim, color: st.dim, weight: 600 });
      }
    }
    // Chord depth dim.
    dimLine(vE, chordLen, -chordDepth / 2, chordLen, chordDepth / 2, (round ? 'D = ' : 'H = ') + fmtIn(chordDepth), { off: 26 });

    // ---- SECTION (chord cross-section with branch footprint) ----
    var secScale = fitScale(chordWidth * 1.6, 110, { min: 4, max: 16 });
    var secOx = vE.px(chordLen) + 145;
    var vS = new View(dwg, { scale: secScale, ox: secOx, oy: 150, flipY: true });
    viewTitle(vS, vS.px(0), vS.py(chordDepth / 2) - 24, 'Chord Section');
    if (round) {
      roundHSSSection(vS, 0, 0, chord, {});
      // Branch saddle band on top.
      plate(vS, -branchWidth / 2, chordDepth / 2 - 0.1, branchWidth, Math.max(chordWidth * 0.05, 0.2), { highlight: true, hatch: false });
      dimLine(vS, -chord.OD / 2, -chord.OD / 2, chord.OD / 2, -chord.OD / 2, 'D = ' + fmtIn(chord.OD), { off: 24 });
      leader(vS, chord.OD / 2 - chord.t / 2, 0, 30, 0, 't = ' + fmtIn(chord.t), { color: st.dim });
    } else {
      rectHSSSection(vS, 0, 0, chord, {});
      plate(vS, -branchWidth / 2, chordDepth / 2, branchWidth, Math.max(chordWidth * 0.05, 0.2), { highlight: true, hatch: false });
      dimLine(vS, -branchWidth / 2, chordDepth / 2, branchWidth / 2, chordDepth / 2, 'Bb = ' + fmtIn(branchWidth), { off: -18 });
      dimLine(vS, -chord.B / 2, -chord.H / 2, chord.B / 2, -chord.H / 2, 'B = ' + fmtIn(chord.B), { off: 24 });
      leader(vS, chord.B / 2 - chord.t / 2, 0, 30, 0, 't = ' + fmtIn(chord.t), { color: st.dim });
    }

    var ref = subType === 'truss'
      ? 'AISC 360-22 Ch.K (§K2) — HSS truss connection, axial limit states'
      : (round ? 'AISC 360-22 Ch.K / DG24 — round HSS moment T/Y/X' : 'AISC 360-22 Ch.K / DG24 — rectangular HSS moment T/Y/X');
    captionBox(dwg, st, state, ref + (conn.Qf != null ? '   (Qf=' + conn.Qf + ')' : ''));
    return dwg.commit();
  }

  /* ----- generic member --------------------------------------------------- */

  /**
   * Render a generic beam/column/wall: an ELEVATION with span loads and a
   * CROSS-SECTION side by side, plus a shear/moment (or axial) diagram below the
   * elevation with peak values called out. Drives simple-span UDL / point-load
   * cases from demands + geometry.
   * @param {SVGSVGElement} svg
   * @param {Object} state
   * @param {Object} [options]
   * @returns {SVGSVGElement}
   */
  function renderMember(svg, state, options) {
    var ctx = newDrawing(svg, options), dwg = ctx.dwg, st = ctx.style;
    var res = (options && options.resolvedGeometry) || {};
    var sec = resolveSection(state.member.section, res);
    var g = state.geometry || {};
    var L = g.L || 120;                      // span, in
    var dep = sec.kind === 'W' ? sec.d : (sec.kind === 'roundHSS' ? sec.OD : sec.H);
    var type = state.member.type || 'beam';
    var lbl = state.member.section || 'Member';

    var Mu = state.demands ? state.demands.Mu : null;   // kip-ft (member calcs)
    var Vu = state.demands ? state.demands.Vu : null;   // kips
    var Pu = state.demands ? state.demands.Pu : null;   // kips

    // ---- ELEVATION (top-left) ----
    var elScale = fitScale(L, 300, { min: 0.4, max: 12 });
    var depPx = Math.min(elScale * dep, 40);             // exaggerate depth a touch if thin
    var depDraw = depPx / elScale;
    var vE = new View(dwg, { scale: elScale, ox: 70, oy: 120, flipY: true });
    viewTitle(vE, vE.px(L / 2), vE.py(depDraw / 2) - 24, 'Elevation');

    // Member body.
    if (sec.kind === 'W') wElevation(vE, 0, 0, L, { d: depDraw, tf: Math.min(sec.tf, depDraw * 0.18) }, { highlight: true });
    else tubeElevation(vE, 0, 0, L, depDraw, { highlight: true });
    memberLabel(vE, L / 2, 0, lbl, { size: st.fsLabel });

    // Supports (simple span) — small triangles at each end.
    support(vE, 0, -depDraw / 2);
    support(vE, L, -depDraw / 2);

    // Loading: UDL if no point load implied, else a central point load.
    var udl = (Mu != null) ? (8 * Mu / (L / 12) / (L / 12)) : null; // back-figure w (k/ft) from Mu=wL^2/8
    distLoad(vE, 0, L, depDraw / 2, 16, udl != null ? ('w (Mu-equiv)') : 'w', { color: st.force });

    // Span dim.
    dimLine(vE, 0, -depDraw / 2, L, -depDraw / 2, 'L = ' + trimNum(L / 12, 2) + " ft", { off: 30 });

    // ---- SHEAR / MOMENT DIAGRAM (below elevation) ----
    var diaTop = 210, diaH = 60;
    var vD = new View(dwg, { scale: elScale, ox: 70, oy: diaTop, flipY: true });
    // Axis line.
    vD.add(el('line', { x1: vD.px(0), y1: diaTop, x2: vD.px(L), y2: diaTop, stroke: st.dim, 'stroke-width': st.lwDim }), 'anno');
    if (type === 'column' || (Pu != null && Mu == null && Vu == null)) {
      // Axial diagram (constant) for a column.
      viewTitle(vD, vD.px(L / 2), diaTop - diaH - 6, 'Axial');
      var ph = Pu != null ? diaH * 0.6 : diaH * 0.3;
      vD.add(rectWorld(vD, 0, 0, L, ph / elScale, { fill: 'rgba(196,43,43,.12)', stroke: st.force, sw: st.lwDim }), 'anno');
      memberLabel(vD, L / 2, ph / elScale + 1, Pu != null ? ('Pu = ' + fmtKip(Pu)) : 'Axial', { color: st.force, size: st.fsForce });
    } else {
      // Parabolic moment diagram + linear shear, simple-span UDL shape.
      viewTitle(vD, vD.px(L / 2), diaTop - diaH - 6, 'Moment  /  Shear');
      // Moment parabola (downward = sagging shown below axis as positive bulge).
      var mPath = 'M' + vD.px(0) + ',' + diaTop;
      var steps = 24;
      for (var i = 1; i <= steps; i++) {
        var xx = L * i / steps;
        var mOrd = 4 * (xx / L) * (1 - xx / L); // 0..1 parabola
        mPath += ' L' + r(vD.px(xx)) + ',' + r(diaTop + mOrd * diaH);
      }
      vD.add(el('path', { d: mPath, fill: 'rgba(179,101,26,.12)', stroke: st.moment, 'stroke-width': st.lwForce }), 'anno');
      if (Mu != null) memberLabel(vD, L / 2, -(diaH * 0.5) / elScale, 'Mu = ' + fmtKft(Mu), { color: st.moment, size: st.fsForce });
      // Shear: linear from +V at left to -V at right (triangle outline).
      var sh = el('polyline', {
        points: vD.px(0) + ',' + (diaTop - diaH * 0.55) + ' ' + vD.px(L / 2) + ',' + diaTop + ' ' + vD.px(L) + ',' + (diaTop + diaH * 0.55),
        fill: 'none', stroke: st.force, 'stroke-width': st.lwDim, 'stroke-dasharray': '4 3'
      });
      vD.add(sh, 'anno');
      if (Vu != null) memberLabel(vD, L * 0.08, -(diaH * 0.55) / elScale - 0.4, 'Vu = ' + fmtKip(Vu), { color: st.force, size: st.fsDim, anchor: 'start' });
    }

    // ---- CROSS-SECTION (right) ----
    var secScale = fitScale((sec.kind === 'W' ? Math.max(sec.d, sec.bf) : (sec.kind === 'roundHSS' ? sec.OD : Math.max(sec.H, sec.B))) * 1.4, 120, { min: 3, max: 16 });
    var secOx = vE.px(L) + 150;
    var vS = new View(dwg, { scale: secScale, ox: secOx, oy: 130, flipY: true });
    viewTitle(vS, vS.px(0), vS.py((sec.kind === 'W' ? sec.d : (sec.kind === 'roundHSS' ? sec.OD : sec.H)) / 2) - 22, 'Section');
    if (sec.kind === 'W') {
      wSection(vS, 0, 0, sec, { highlight: true });
      dimLine(vS, sec.bf / 2, -sec.d / 2, sec.bf / 2, sec.d / 2, 'd = ' + fmtIn(sec.d), { off: 24 });
      dimLine(vS, -sec.bf / 2, sec.d / 2, sec.bf / 2, sec.d / 2, 'bf = ' + fmtIn(sec.bf), { off: -18 });
    } else if (sec.kind === 'roundHSS') {
      roundHSSSection(vS, 0, 0, sec, { highlight: true });
      dimLine(vS, -sec.OD / 2, -sec.OD / 2, sec.OD / 2, -sec.OD / 2, 'D = ' + fmtIn(sec.OD), { off: 24 });
    } else {
      rectHSSSection(vS, 0, 0, sec, { highlight: true });
      dimLine(vS, sec.B / 2, -sec.H / 2, sec.B / 2, sec.H / 2, 'H = ' + fmtIn(sec.H), { off: 24 });
      dimLine(vS, -sec.B / 2, -sec.H / 2, sec.B / 2, -sec.H / 2, 'B = ' + fmtIn(sec.B), { off: 22 });
    }
    memberLabel(vS, 0, -((sec.kind === 'W' ? sec.d : (sec.kind === 'roundHSS' ? sec.OD : sec.H)) / 2) - 1.5, lbl, { size: st.fsLabel });

    captionBox(dwg, st, state, (type === 'column' ? 'Member — axial' : 'Member — flexure (simple-span UDL)') + '  ·  ' + lbl);
    return dwg.commit();
  }

  /* ----- unknown fallback ------------------------------------------------- */

  /** Render a minimal placeholder for an unrecognized calcType. @private */
  function renderUnknown(svg, state, options) {
    var ctx = newDrawing(svg, options), dwg = ctx.dwg, st = ctx.style;
    var v = new View(dwg, { scale: 6, ox: 60, oy: 90, flipY: true });
    rectHSSSection(v, 0, 0, { kind: 'rectHSS', H: 8, B: 8, t: 0.291 }, {});
    memberLabel(v, 0, -6, 'Unsupported calcType: ' + (state && state.calcType), { color: st.dim, size: st.fsLabel });
    return dwg.commit();
  }

  /* ==========================================================================
   * RENDERER-LEVEL HELPERS
   * ========================================================================*/

  /** Draw a small support triangle (pinned) at a world point. @private */
  function support(v, x, yTop) {
    var st = v.style;
    var px = v.px(x), py = v.py(yTop);
    var w = 9, h = 9;
    v.add(el('path', { d: 'M' + r(px) + ',' + r(py) + ' L' + r(px - w) + ',' + r(py + h) + ' L' + r(px + w) + ',' + r(py + h) + ' z', fill: 'none', stroke: st.steel, 'stroke-width': st.lwObjectThin }), 'steel');
    v.add(el('line', { x1: px - w - 3, y1: py + h, x2: px + w + 3, y2: py + h, stroke: st.steel, 'stroke-width': st.lwObjectThin }), 'steel');
    v.dwg.extend(px - w - 3, py + h + 2);
  }

  /**
   * Draw a small caption box at the bottom-left of the drawing with the code
   * reference and (if present in results) the governing limit state.
   * @private
   */
  function captionBox(dwg, st, state, ref) {
    var res = state && state.results;
    var gov = res && res.governing ? res.governing : null;
    var status = res && res.status ? res.status : null;
    var x = dwg.minX, y = dwg.maxY + 8;
    var g = el('g', { 'class': 'are-caption' });
    var t1 = el('text', { x: r(x), y: r(y), fill: st.dim, 'font-size': st.fsDim, 'font-family': st.font });
    t1.textContent = ref;
    g.appendChild(t1);
    if (gov) {
      var t2 = el('text', { x: r(x), y: r(y + 13), fill: st.title, 'font-size': st.fsDim, 'font-family': st.font, 'font-weight': 600 });
      t2.textContent = 'Governs: ' + gov + (status ? '  [' + status + ']' : '');
      g.appendChild(t2);
      dwg.extend(x, y + 18);
    }
    dwg.gAnno.appendChild(g);
    dwg.extend(x, y); dwg.extend(x + ref.length * 5.4, y);
  }

  /** Coerce a rect geometry to an equivalent round (uses larger dim as OD). @private */
  function toRound(g) {
    if (g.kind === 'roundHSS') return g;
    var od = Math.max(g.H || g.B || 8, g.B || g.H || 8);
    return { kind: 'roundHSS', OD: od, t: g.t || 0.291, _fallback: g._fallback };
  }
  /** Coerce a round geometry to an equivalent square rect. @private */
  function toRect(g) {
    if (g.kind === 'rectHSS') return g;
    return { kind: 'rectHSS', H: g.OD || 8, B: g.OD || 8, t: g.t || 0.291, _fallback: g._fallback };
  }

  /* ==========================================================================
   * NON-BROWSER SHIM (Node smoke tests)
   * --------------------------------------------------------------------------
   * When there is no global.document (e.g. running under plain Node for the
   * smoke test), provide a minimal element shim that supports the subset of DOM
   * used here (createElementNS, setAttribute, appendChild, textContent,
   * firstChild/removeChild, getAttribute) and serializes to an SVG string via
   * .outerHTML / a toString. This keeps the library single-file and testable
   * without a DOM dependency. It is INERT in real browsers.
   * ========================================================================*/

  function makeShimNode(tag) {
    return new ShimNode(tag);
  }
  function ShimNode(tag) {
    this.tagName = tag;
    this.attributes = {};
    this.children = [];
    this._text = '';
    this.parentNode = null;
  }
  ShimNode.prototype.setAttribute = function (k, v) { this.attributes[k] = v; };
  ShimNode.prototype.getAttribute = function (k) { return this.attributes.hasOwnProperty(k) ? this.attributes[k] : null; };
  ShimNode.prototype.appendChild = function (c) { c.parentNode = this; this.children.push(c); return c; };
  ShimNode.prototype.insertBefore = function (c, ref) {
    var i = this.children.indexOf(ref);
    if (i < 0) this.children.push(c); else this.children.splice(i, 0, c);
    c.parentNode = this; return c;
  };
  ShimNode.prototype.removeChild = function (c) {
    var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c;
  };
  Object.defineProperty(ShimNode.prototype, 'firstChild', {
    get: function () { return this.children.length ? this.children[0] : null; }
  });
  Object.defineProperty(ShimNode.prototype, 'nextSibling', {
    get: function () {
      if (!this.parentNode) return null;
      var i = this.parentNode.children.indexOf(this);
      return (i >= 0 && i + 1 < this.parentNode.children.length) ? this.parentNode.children[i + 1] : null;
    }
  });
  Object.defineProperty(ShimNode.prototype, 'textContent', {
    get: function () { return this._text; },
    set: function (v) { this._text = String(v); this.children = []; }
  });
  function escAttr(s) { return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
  function escText(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  ShimNode.prototype.serialize = function () {
    var a = '';
    for (var k in this.attributes) a += ' ' + k + '="' + escAttr(this.attributes[k]) + '"';
    var inner = '';
    if (this._text) inner += escText(this._text);
    for (var i = 0; i < this.children.length; i++) inner += this.children[i].serialize();
    if (!inner && !this._text) return '<' + this.tagName + a + '/>';
    return '<' + this.tagName + a + '>' + inner + '</' + this.tagName + '>';
  };
  Object.defineProperty(ShimNode.prototype, 'outerHTML', {
    get: function () { return this.serialize(); }
  });

  /**
   * Create a detached shim <svg> root usable for Node-side rendering/tests.
   * In a browser this is unnecessary (pass a real element); it exists so the
   * renderers can be exercised headless. Returns an object with .outerHTML.
   * @returns {Object} a shim SVG element
   */
  function createSVG() {
    var s = new ShimNode('svg');
    s.setAttribute('xmlns', SVGNS);
    return s;
  }

  /* ==========================================================================
   * PUBLIC API
   * ========================================================================*/

  var AREDraw = {
    // Versioning
    VERSION: '1.0.0',

    // Style
    LIGHT: LIGHT, DARK: DARK, resolveStyle: resolveStyle,

    // Section geometry
    setShapeDB: setShapeDB,
    resolveSection: resolveSection,
    parseSectionLabel: parseSectionLabel,

    // Engine
    Drawing: Drawing,
    View: View,

    // Primitives — steel
    wSection: wSection,
    wElevation: wElevation,
    rectHSSSection: rectHSSSection,
    roundHSSSection: roundHSSSection,
    tubeElevation: tubeElevation,
    plate: plate,

    // Primitives — bolts / welds / centerlines
    bolt: bolt,
    boltPattern: boltPattern,
    centerline: centerline,
    weldFillet: weldFillet,

    // Annotations
    dimLine: dimLine,
    leader: leader,
    forceArrow: forceArrow,
    distLoad: distLoad,
    momentArrow: momentArrow,
    viewTitle: viewTitle,
    memberLabel: memberLabel,

    // Formatting
    fmtIn: fmtIn, fmtKip: fmtKip, fmtKft: fmtKft, fmtKin: fmtKin,

    // Layout
    fitScale: fitScale,

    // High-level renderers
    renderConnection: renderConnection,
    renderMember: renderMember,

    // Headless helpers (Node)
    createSVG: createSVG
  };

  // Expose as a global (browser) and via module.exports (Node smoke test).
  global.AREDraw = AREDraw;
  if (typeof module !== 'undefined' && module.exports) module.exports = AREDraw;

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
