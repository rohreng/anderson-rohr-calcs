/* =============================================================================
   SWV — Stacked Shearwall Designer views: wall elevation + level plan, as SVG
   strings.  DOM-free.  window.SWV / module.exports.
   (docs/plans/2026-09-30-shearwall-views-plan.md §2, §3, Phase 2)

   Both builders draw from the SAME SW.compute() result the result panes use —
   nothing is recomputed here.  Every numeric label carries
     data-q  the quantity (T, C, V, vmax, P, L, b, h, …)
     data-v  the value drawn (ASD, unrounded to 1e-4)
     data-k  where it came from: a path into `res` ("floors.3.walls.0.cases.
             wind.ends.0.T"), prefixed "plan:" into the planModel object, or
             prefixed "state:" into the input model (a segmented wall's
             opening sizes only — the engine keeps no A_o row for them)
   so a test can prove every drawn number is the engine's number.  Every wall
   group carries data-wall / data-fi / data-wi.  Colours come from CSS classes
   (sw-*; the host page styles them on its --are-* tokens), never from
   hard-coded fills; all text is escaped.

   elevationSVG(res, state, opts)  opts { id, caseKey: 'gov'|'wind'|'seismic',
                                          dirSign: 1|-1, pxW, pxH }
   planSVG(plan, k, opts)          plan = SW.planModel(state, res);
                                   opts { caseKey, showEnds, pxW }
   Both return { svg, warnings[] }.

   Dependency: SW (engines/stacked-shearwall.js) for layoutWall, resolved
   lazily — the page loads the engine first.
   ========================================================================== */
(function (root) {
  'use strict';

  var CASE = {
    wind:    { key: 'wind',    label: 'Wind',    asd: '0.6W' },
    seismic: { key: 'seismic', label: 'Seismic', asd: '0.7E' }
  };

  function sw() {
    var S = root.SW || (typeof require === 'function' ? require('./stacked-shearwall.js') : null);
    if (!S || !S.layoutWall) throw new Error('SWV: SW engine (engines/stacked-shearwall.js) is not loaded.');
    return S;
  }

  // ── helpers ────────────────────────────────────────────────────────────────
  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fin(v) { return typeof v === 'number' && isFinite(v); }
  function px(v) { return String(Math.round(v * 10) / 10); }
  function dv(v) { return String(Math.round(v * 1e4) / 1e4); }
  function grp(s) { return s.replace(/([0-9])(?=([0-9]{3})+(?![0-9]))/g, '$1,'); }
  function fmt(v, d) {
    if (!fin(v)) return 'n/a';
    var s = Math.abs(v).toFixed(d), i = s.indexOf('.');
    s = i < 0 ? grp(s) : grp(s.slice(0, i)) + s.slice(i);
    return (v < 0 && Number(s.replace(/,/g, '')) !== 0 ? '−' : '') + s;
  }
  function lb(v) { return fmt(v, 1) + ' lb'; }
  function plf(v) { return fmt(v, 2) + ' plf'; }
  function ft(v) { return fmt(v, 2) + ' ft'; }
  // One numeric span: <tspan data-q data-v data-k>text</tspan>. A value that
  // is not finite prints "n/a" and carries no data-v (never "NaN" in the SVG).
  function nspan(q, v, k, text) {
    if (!fin(v)) return '<tspan class="sw-na" data-q="' + esc(q) + '">n/a</tspan>';
    return '<tspan data-q="' + esc(q) + '" data-v="' + dv(v) + '" data-k="' + esc(k) + '">' + esc(text) + '</tspan>';
  }
  // A text element from parts: strings (escaped) and nspan() output (raw).
  function T(x, y, parts, cls, anchor, size, extra) {
    var body = parts.map(function (p) { return p && p.raw ? p.raw : esc(p); }).join('');
    return '<text class="sw-t' + (cls ? ' ' + cls : '') + '" x="' + px(x) + '" y="' + px(y) + '"'
      + (anchor ? ' text-anchor="' + anchor + '"' : '') + ' font-size="' + (size || 11) + '"' + (extra || '') + '>' + body + '</text>';
  }
  function N(q, v, k, text) { return { raw: nspan(q, v, k, text), len: fin(v) ? String(text).length : 3 }; }
  // Text width estimate: characters × size × CW (DM Sans / Segoe UI, mixed
  // digits and lower case run about 0.55 em; 0.57 errs wide so boxes clear).
  var CW = 0.57;
  function partLen(p) { return p && p.raw ? (p.len || 0) : String(p == null ? '' : p).length; }
  function partsLen(parts) { return parts.reduce(function (a, p) { return a + partLen(p); }, 0); }
  function textW(parts, size) { return partsLen(parts) * size * CW; }
  // Flow parts into lines no wider than maxW px: plain strings break at
  // spaces, numeric spans never break, and an array part is a phrase kept on
  // one line unless it alone is too long. A line never starts with a space or
  // a bare "·" separator.
  function flow(parts, maxW, size) {
    var maxC = Math.max(12, Math.floor(maxW / (size * CW))), toks = [];
    var split = function (list) {
      var out = [];
      list.forEach(function (p) {
        if (p && p.raw) out.push(p);
        else if (Array.isArray(p)) out.push({ grp: p, len: p.reduce(function (a, q) { return a + (Array.isArray(q) ? 0 : partLen(q)); }, 0) });
        else String(p == null ? '' : p).split(/(?= )/).forEach(function (t) { if (t) out.push(t); });
      });
      return out;
    };
    toks = split(parts);
    var lines = [], cur = [], n = 0;
    for (var i = 0; i < toks.length; i++) {
      var t = toks[i];
      if (t.grp && t.len > maxC) { toks.splice.apply(toks, [i, 1].concat(split(t.grp))); i--; continue; }
      var l = t.grp ? t.len : partLen(t);
      if (n && n + l > maxC) { lines.push(cur); cur = []; n = 0; }
      if (!n && typeof t === 'string') { t = t.replace(/^ +/, '').replace(/^· ?/, ''); l = t.length; if (!l) continue; }
      if (t.grp) cur = cur.concat(t.grp); else cur.push(t);
      n += l;
    }
    if (cur.length) lines.push(cur);
    return lines;
  }
  function rect(x, y, w, h, cls, extra) {
    return '<rect class="' + cls + '" x="' + px(x) + '" y="' + px(y) + '" width="' + px(Math.max(w, 0)) + '" height="' + px(Math.max(h, 0)) + '"' + (extra || '') + '/>';
  }
  function line(x1, y1, x2, y2, cls) {
    return '<line class="' + cls + '" x1="' + px(x1) + '" y1="' + px(y1) + '" x2="' + px(x2) + '" y2="' + px(y2) + '"/>';
  }
  // Arrow from (x1, y1) to (x2, y2), head at the end; colour from `cls`.
  function arrow(x1, y1, x2, y2, cls) {
    var dx = x2 - x1, dy = y2 - y1, L = Math.sqrt(dx * dx + dy * dy) || 1, ux = dx / L, uy = dy / L, hs = 7, hw = 3.5;
    var bx = x2 - ux * hs, by = y2 - uy * hs;
    return '<g class="sw-arrow ' + cls + '">' + line(x1, y1, bx, by, 'sw-arrow-l')
      + '<polygon class="sw-arrow-h" points="' + px(x2) + ',' + px(y2) + ' ' + px(bx - uy * hw) + ',' + px(by + ux * hw) + ' ' + px(bx + uy * hw) + ',' + px(by - ux * hw) + '"/></g>';
  }
  // Split a note into lines of at most `max` characters, at spaces.
  function wrap(t, max) {
    var lines = [], cur = '';
    String(t).split(' ').forEach(function (w) {
      if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w;
    });
    if (cur) lines.push(cur);
    return lines;
  }
  function svgOpen(W, H, cls, label, extra) {
    return '<svg xmlns="http://www.w3.org/2000/svg" class="sw-view ' + cls + '" viewBox="0 0 ' + px(W) + ' ' + px(H) + '" width="' + px(W) + '" height="' + px(H)
      + '" preserveAspectRatio="xMidYMin meet" role="img" aria-label="' + esc(label) + '" font-family="DM Sans, Segoe UI, system-ui, sans-serif"' + (extra || '') + '>';
  }

  // ── elevation ──────────────────────────────────────────────────────────────
  // One story box per level, top -> base, End 1 at the left. The load arrow
  // at the top of each story points `dirSign` (1 = toward End 2); the story
  // shear V at its base resists it. With dirSign 1 the wall overturns about
  // End 2: T at End 1 (ends[0].T, M_R1 carries the End 1 point load), C at
  // End 2 (ends[1].C); dirSign −1 swaps them. Segmented: the same per segment.
  function elevationSVG(res, state, opts) {
    opts = opts || {};
    var warnings = [];
    if (!res || !res.stacks || !Array.isArray(res.floors) || !res.floors.length || !Array.isArray(res.levels) || !res.levels.length) {
      return { svg: '', warnings: ['No computed model to draw (fix the model errors first).'] };
    }
    var S = sw(), floors = (state && state.floors) || [];
    var id = opts.id != null ? opts.id : res.stackIds[0];
    var st = Object.prototype.hasOwnProperty.call(res.stacks, id) ? res.stacks[id] : null;
    if (!st) return { svg: '', warnings: ['Wall "' + id + '" is not in the model.'] };
    var n = res.levels.length, dirSign = opts.dirSign === -1 ? -1 : 1;
    var at = {};   // level k -> wall index
    st.levels.forEach(function (k, i) { at[k] = st.wi[i]; });
    // Case: 'gov' = the case governing v_max at the lowest level of the wall.
    var baseRw = res.floors[st.bottom].walls[at[st.bottom]];
    var ck = opts.caseKey === 'wind' || opts.caseKey === 'seismic' ? opts.caseKey : baseRw.gov.vmaxCase;
    var cs = CASE[ck], gov = !(opts.caseKey === 'wind' || opts.caseKey === 'seismic');

    // Geometry (px). Horizontal scale fits the longest level; vertical is the
    // same scale unless a story would be flatter than MIN_H px (then the
    // vertical scale is exaggerated and the drawing says so).
    var pxW = opts.pxW > 200 ? opts.pxW : 760, ML = 124, MR = 136, GA = 70, GB = 92, MB = 62, MIN_H = 80, MAX_H = 200, ROW = 14;
    // Layout of every present level once: the drawn extent includes pieces
    // outside 0..L (an opening before End 1, overflow past End 2), and a
    // segmented level takes one reaction-label row per segment.
    var lays = {}, extra = {}, xMin = 0, xMax = 0, hmin = Infinity, hmax = 0, extraTot = 0, stamps = {};
    for (var k0 = 0; k0 < n; k0++) {
      var h0 = res.levels[k0].h_ft;
      if (h0 > 0) { hmin = Math.min(hmin, h0); hmax = Math.max(hmax, h0); }
      extra[k0] = 0;
      if (at[k0] == null) continue;
      var rw0 = res.floors[k0].walls[at[k0]], sw00 = floors[k0] && floors[k0].walls ? floors[k0].walls[at[k0]] : null;
      var ly = lays[k0] = S.layoutWall(sw00 || { L_ft: rw0.L_ft, segments_ft: rw0.geom.segments.map(function (g) { return g.b; }), openings: [] }, h0);
      if (ly.mode === 'assumed' && ly.assumed) stamps.assumed = true;
      if (ly.mode === 'partial') stamps.partial = true;
      xMax = Math.max(xMax, rw0.L_ft || 0);
      ly.pieces.forEach(function (p) { xMin = Math.min(xMin, p.x0); xMax = Math.max(xMax, p.x1); });
      if (rw0.method === 'segmented') {
        extra[k0] = ly.pieces.filter(function (p) { return p.kind === 'seg'; }).length * ROW;
        extraTot += extra[k0];
      }
    }
    var Lmax = xMax - xMin;
    if (!(Lmax > 0)) Lmax = 1;
    if (!(hmin < Infinity)) { hmin = 1; hmax = 1; }
    var sx = (pxW - ML - MR) / Lmax, sy = sx;
    if (hmin * sy < MIN_H) sy = MIN_H / hmin;
    if (hmax * sy > MAX_H) sy = MAX_H / hmax;
    // Header: title, the case line flowed to the width, and the layout stamp
    // beside the title when it fits, else on its own line (MT follows).
    var title = (baseRw.label || id) + (String(baseRw.label) !== String(id) ? ' (' + id + ')' : '') + ' — elevation';
    var hdr = [], hy = 22;
    hdr.push(T(8, hy, [title], 'sw-title', 'start', 17));
    var subLines = flow([(gov ? 'Governing v_max case (base-level governing case, drawn on every level): ' : 'Case: ') + cs.label + ' (' + cs.asd + '), ASD forces · load ' + (dirSign === 1 ? '→ toward End 2' : '← toward End 1')], pxW - 16, 13);
    subLines.forEach(function (ln) { hy += 18; hdr.push(T(8, hy, ln, 'sw-sub', 'start', 13)); });
    if (stamps.assumed || stamps.partial) {
      var sText = stamps.partial ? 'SOME OPENING POSITIONS ASSUMED' : 'LAYOUT ORDER ASSUMED';
      if (stamps.assumed && stamps.partial) sText = 'LAYOUT ORDER ASSUMED · SOME OPENING POSITIONS ASSUMED';
      if (8 + textW([title], 17) + 24 + textW([sText], 12) <= pxW - 8) hdr.push(T(pxW - 8, 22, [sText], 'sw-stamp', 'end', 12));
      else { hy += 18; hdr.push(T(8, hy, [sText], 'sw-stamp', 'start', 12)); }
    }
    var MT = hy + 12;
    var HtotFt = res.levels.reduce(function (a, l) { return a + (l.h_ft || 0); }, 0);
    if (opts.pxH > 0) {
      var room = opts.pxH - MT - MB - n * (GA + GB) - extraTot;
      if (room > 0 && HtotFt > 0) sy = Math.max(30 / hmin, room / HtotFt);
    }
    var exaggerated = Math.abs(sy - sx) > 1e-9 * sx;
    var Hpx = MT + MB + n * (GA + GB) + extraTot + HtotFt * sy;
    var X = function (x) { return ML + (x - xMin) * sx; };

    var out = [], uid = 'swe' + String(id).replace(/[^A-Za-z0-9_-]/g, '_');
    out.push('<g class="sw-wall sw-elev-wall" data-wall="' + esc(id) + '">');
    out.push(hdr.join(''));

    var nearestL = function (k) {
      var best = null, dist = Infinity;
      st.levels.forEach(function (j) { if (Math.abs(j - k) < dist) { dist = Math.abs(j - k); best = j; } });
      return best === null ? Lmax : res.floors[best].walls[at[best]].L_ft;
    };
    var y = MT;
    for (var k = 0; k < n; k++) {
      var lv = res.levels[k], hpx = lv.h_ft * sy, yT = y + GA, yB = yT + hpx;
      var wi = at[k], present = wi != null;
      var lvlLbl = [lv.name + ' · h = ', N('h', lv.h_ft, 'levels.' + k + '.h_ft', fmt(lv.h_ft, 2) + ' ft'), ' · El. ', N('elevBot', lv.elevBot_ft, 'levels.' + k + '.elevBot_ft', fmt(lv.elevBot_ft, 2)), '–', N('elevTop', lv.elevTop_ft, 'levels.' + k + '.elevTop_ft', fmt(lv.elevTop_ft, 2) + ' ft')];
      out.push(T(8, yT - 56, lvlLbl, 'sw-lvl', 'start', 13));
      if (!present) {
        var Lg = nearestL(k);
        out.push(rect(X(0), yT, Lg * sx, hpx, 'sw-ghost'));
        var why = k < st.top ? 'Wall not present — it starts below this level.'
          : (k > st.bottom ? (st.lineBelow ? 'Wall ends above: its shear is collected into line ' + st.line + ' and carried by the walls below; its overturning stops — verify the transfer.' : 'Wall ends above this level; its overturning stops — verify the load path.')
          : 'Wall absent at this level — transfer declared on the wall below (SDPWS §4.3.6.4.4); the transfer element is outside this calculation.');
        out.push(T(X(0) + 8, yT + hpx / 2 + 4, [why], 'sw-note', 'start', 12));
        y = yB + GB;
        continue;
      }
      var rw = res.floors[k].walls[wi], sw0 = floors[k] && floors[k].walls ? floors[k].walls[wi] : null;
      var base = 'floors.' + k + '.walls.' + wi, cp = base + '.cases.' + ck, c = rw.cases[ck];
      var L = rw.L_ft, seg = rw.method === 'segmented';
      var lay = lays[k], ex = extra[k];
      lay.warnings.forEach(function (lw) { warnings.push(lv.name + ': ' + lw.text); });
      out.push('<g class="sw-level" data-wall="' + esc(id) + '" data-fi="' + k + '" data-wi="' + wi + '">');
      // L dimension above the box.
      out.push(line(X(0), yT - 8, X(L), yT - 8, 'sw-dim'));
      out.push(line(X(0), yT - 12, X(0), yT - 4, 'sw-dim') + line(X(L), yT - 12, X(L), yT - 4, 'sw-dim'));
      out.push(T(X(L / 2), yT - 12, ['L = ', N('L', L, base + '.L_ft', fmt(L, 2) + ' ft')], 'sw-dimt', 'middle', 12));
      // h dimension at the left.
      out.push(T(X(0) - 8, yT + hpx / 2 + 4, ['h ', N('h', rw.h_ft, base + '.h_ft', fmt(rw.h_ft, 2) + "'")], 'sw-dimt', 'end', 12));
      // Pieces: every rect first, then the labels, so no piece covers a label.
      var lbls = [];
      lay.pieces.forEach(function (p) {
        var x0 = X(p.x0), wpx = p.w * sx;
        if (p.kind === 'seg') {
          var g = rw.geom.segments[p.i] || {}, rule = g.rule || '';
          var cls = 'sw-seg' + (rule === '× 2b/h' ? ' sw-seg-red' : '') + (rule.indexOf('excluded') === 0 ? ' sw-seg-excl' : '') + (p.short || p.overflow ? ' sw-bad' : '');
          out.push(rect(x0, yT, wpx, hpx, cls));
          if (rule.indexOf('excluded') === 0) out.push(hatch(x0, yT, wpx, hpx));
          var bl = ['b', N('b', g.b, base + '.geom.segments.' + p.i + '.b', String(p.i + 1) + ' = ' + fmt(g.b, 2) + "'")];
          lbls.push(T(x0 + wpx / 2, yT + 16, bl, 'sw-segt', 'middle', 12));
          if (rule === '× 2b/h') lbls.push(T(x0 + wpx / 2, yT + 30, ['× 2b/h (h/b ', N('hOverB', g.hOverB, base + '.geom.segments.' + p.i + '.hOverB', fmt(g.hOverB, 2)), ')'], 'sw-tag', 'middle', 11));
          if (rule.indexOf('excluded') === 0) lbls.push(T(x0 + wpx / 2, yT + 30, ['h/b > 3.5 — excluded'], 'sw-tag sw-bad-t', 'middle', 11));
          if (p.short) lbls.push(T(x0 + wpx / 2, yB - 6, ['b does not fit'], 'sw-tag sw-bad-t', 'middle', 11));
        } else if (p.kind === 'open') {
          // Perforated: the A_o rows (h/3 floor drawn dashed). Segmented: no
          // A_o — the opening is a gap, labelled from the input ("state:").
          var o = seg ? null : rw.geom.openings[p.j], oh = (o ? o.hc : p.hc) * sy, oy = yT + (hpx - oh) / 2;
          if (o && o.floored) {
            var he = o.hEff * sy;
            out.push(rect(x0, yT + (hpx - he) / 2, wpx, he, 'sw-h3'));
          }
          out.push(rect(x0, oy, wpx, oh, 'sw-open' + (p.overflow ? ' sw-bad' : '')));
          if (o) {
            lbls.push(T(x0 + wpx / 2, oy + oh / 2 + 4, [N('w', o.w, base + '.geom.openings.' + p.j + '.w', fmt(o.w, 2)), ' × ', N('hc', o.hc, base + '.geom.openings.' + p.j + '.hc', fmt(o.hc, 2))], 'sw-opent', 'middle', 12));
            if (o.floored) lbls.push(T(x0 + wpx / 2, oy + oh / 2 + 18, ['h/3 = ', N('hEff', o.hEff, base + '.geom.openings.' + p.j + '.hEff', fmt(o.hEff, 2))], 'sw-tag', 'middle', 11));
          } else {
            var sk = 'state:floors.' + k + '.walls.' + wi + '.openings.' + p.j;
            lbls.push(T(x0 + wpx / 2, oy + oh / 2 + 4, [N('w', p.w, sk + '.w_ft', fmt(p.w, 2)), ' × ', N('hc', p.hc, sk + '.hc_ft', fmt(p.hc, 2))], 'sw-opent', 'middle', 12));
          }
        } else {
          out.push(rect(x0, yT, wpx, hpx, 'sw-unsh'));
        }
      });
      out.push(rect(X(0), yT, L * sx, hpx, 'sw-box'));
      out.push(lbls.join(''));
      if (lay.pieces.some(function (p) { return p.x1 > L + 1e-6; })) out.push(line(X(L), yT - 4, X(L), yB + 4, 'sw-end2'));

      // Story increment at the top edge (this level's row of the case).
      var row = null, ri = -1;
      for (var r = 0; r < c.rows.length; r++) if (c.rows[r].j === k) { row = c.rows[r]; ri = r; }
      var aL = dirSign === 1 ? X(0) - 86 : X(L) + 86, aR = dirSign === 1 ? X(0) - 4 : X(L) + 4;
      if (row) {
        out.push(arrow(aL, yT + 6, aR, yT + 6, 'sw-load'));
        var pl = [cs.asd + ' ', N('P', row.Pfac, cp + '.rows.' + ri + '.Pfac', lb(row.Pfac))];
        // The label ends clear of the L dimension tick at the wall end.
        out.push(T(dirSign === 1 ? X(0) - 8 : X(L) + 8, yT - 3, pl, 'sw-loadt', dirSign === 1 ? 'end' : 'start', 12));
        if (row.share < 1 - 1e-12) out.push(T((aL + aR) / 2, yT + 22, ['line share ', N('share', row.share, cp + '.rows.' + ri + '.share', fmt(row.share * 100, 1) + ' %')], 'sw-tag', 'middle', 11));
      }
      // Dead load on the top (this level's dlRow).
      var dl = c.dlRows && c.dlRows.length ? c.dlRows[c.dlRows.length - 1] : null, dli = c.dlRows ? c.dlRows.length - 1 : -1;
      if (dl && dl.w_plf > 0) {
        for (var q = 1; q <= 5; q++) out.push(arrow(X(L * q / 6), yT - 36, X(L * q / 6), yT - 22, 'sw-dead'));
        out.push(T(X(L) - 2, yT - 40, ['D: w = ', N('w_plf', dl.w_plf, cp + '.dlRows.' + dli + '.w_plf', fmt(dl.w_plf, 1) + ' plf')], 'sw-deadt', 'end', 11));
      }
      if (dl && dl.P_end_lb > 0) {
        out.push(arrow(X(0) + 3, yT - 36, X(0) + 3, yT - 2, 'sw-dead'));
        out.push(T(X(0) + 8, yT - 40, ['P_D = ', N('P_end', dl.P_end_lb, cp + '.dlRows.' + dli + '.P_end_lb', lb(dl.P_end_lb)), ' @ End 1'], 'sw-deadt', 'start', 11));
      }
      // Story shear at the base, resisting the load.
      var cxm = X(L / 2), half = Math.min(L * sx * 0.2, 60);
      out.push(arrow(cxm + dirSign * half, yB + 6, cxm - dirSign * half, yB + 6, 'sw-shear'));
      var vLbl = ['V = ', N('V', c.V, cp + '.V', lb(c.V)), ' · ' + (seg ? 'v_eff' : 'v_max') + ' = ', N('vmax', c.vmax, cp + '.vmax', plf(c.vmax))];
      out.push(T(X(L / 2), yB + 48 + ex, vLbl, 'sw-vt', 'middle', 13));
      // Reactions.
      var tEnd = dirSign === 1 ? 0 : 1, cEnd = 1 - tEnd;
      if (!seg) {
        var xT = tEnd === 0 ? X(0) : X(L), xC = cEnd === 0 ? X(0) : X(L);
        out.push(reaction(xT, yB, 'T', c.ends[tEnd].T, cp + '.ends.' + tEnd + '.T', tEnd === 0 ? 'end' : 'start'));
        out.push(reaction(xC, yB, 'C', c.ends[cEnd].C, cp + '.ends.' + cEnd + '.C', cEnd === 0 ? 'end' : 'start'));
      } else {
        // One label row per segment under the arrows (no overlap however
        // narrow the segments), anchored at the segment's End 1 side, or at
        // its End 2 side when the text would run off the drawing.
        var srow = 0;
        lay.pieces.forEach(function (p) {
          if (p.kind !== 'seg' || !c.segments[p.i]) return;
          var sg = c.segments[p.i], sp = cp + '.segments.' + p.i;
          var xt = tEnd === 0 ? X(p.x0) + 3 : X(p.x1) - 3, xc = cEnd === 0 ? X(p.x0) + 3 : X(p.x1) - 3;
          out.push(arrow(xt, yB + 2, xt, yB + 18, 'sw-react sw-tens') + arrow(xc, yB + 18, xc, yB + 2, 'sw-react sw-comp'));
          var right = X(p.x0) + 6 + 250 > pxW - 4, lx = right ? X(p.x1) - 6 : X(p.x0) + 6;
          out.push(T(lx, yB + 32 + srow * ROW, ['T' + (p.i + 1) + ' = ', N('T', sg.ends[tEnd].T, sp + '.ends.' + tEnd + '.T', lb(sg.ends[tEnd].T)), ' · C' + (p.i + 1) + ' = ', N('C', sg.ends[cEnd].C, sp + '.ends.' + cEnd + '.C', lb(sg.ends[cEnd].C)), p.overflow ? ' (not placed — drawn past End 2)' : ''], 'sw-reactt' + (p.overflow ? ' sw-bad-t' : ''), right ? 'end' : 'start', 11));
          srow++;
        });
      }
      // Hardware line: hold-down and sill.
      var sill = rw.sill && rw.sill.conn ? rw.sill.conn.label + ' @ ' + fmt(rw.sill.spacing, 1) + '" o.c.' : '';
      out.push(T(X(L / 2), yB + 65 + ex, [(rw.holdown ? 'Hold-down: ' + rw.holdown.label : '') + (sill ? ' · sill: ' + sill : '')], 'sw-hw', 'middle', 11));
      if (rw.base) {
        var bl2 = [];
        if (!seg && fin(c.t)) bl2.push('t = ', N('t', c.t, cp + '.t', plf(c.t)), ' (§4.3.6.4.2.1)');
        if (rw.uplift && fin(rw.uplift.T_req)) bl2.push(bl2.length ? ' · ' : '', 'T_req = ', N('T_req', rw.uplift.T_req, base + '.uplift.T_req', lb(rw.uplift.T_req)), ' per bolt (' + rw.gov.vmaxCase + ' t)');
        if (bl2.length) out.push(T(X(L / 2), yB + 80 + ex, bl2, 'sw-hw', 'middle', 11));
      }
      out.push('</g>');
      y = yB + GB + ex;
    }
    // Notes and stamps.
    var notes = ['C = overturning compression + gravity on the end post, with no dead-load relief; T includes the 0.6D resisting moment — so ΣF_y does not close on this drawing (the engine identities are tested instead).'];
    if (exaggerated) notes.push('Vertical scale differs from horizontal for legibility (horizontal ' + fmt(sx, 2) + ' px/ft, vertical ' + fmt(sy, 2) + ' px/ft).');
    var nl = [];
    notes.forEach(function (t) { wrap(t, Math.floor((pxW - 16) / (12 * CW))).forEach(function (x) { nl.push(x); }); });
    Hpx += Math.max(0, nl.length - 2) * 16;
    nl.forEach(function (t, i) { out.push(T(8, Hpx - MB + 22 + i * 16, [t], 'sw-note', 'start', 12)); });
    out.push('</g>');
    var defs = '<defs><pattern id="' + uid + '-hatch" patternUnits="userSpaceOnUse" width="8" height="8"><path class="sw-hatch" d="M0,8 L8,0"/></pattern></defs>';
    var svg = svgOpen(pxW, Hpx, 'sw-elev', title, ' data-case="' + ck + '" data-dir="' + dirSign + '"') + defs + out.join('') + '</svg>';
    return { svg: svg, warnings: warnings, caseKey: ck, layoutStamp: stamps.partial ? 'partial' : (stamps.assumed ? 'assumed' : null) };

    function hatch(x, y0, w, h) { return rect(x, y0, w, h, 'sw-hatch-ov', ' fill="url(#' + uid + '-hatch)"'); }
    // T: a downward pull under the end; C: an upward push into it.
    function reaction(x, yb, q, v, k, anchor) {
      var up = q === 'C', y1 = yb + 20, s = '';
      s += up ? arrow(x, y1, x, yb + 2, 'sw-react sw-comp') : arrow(x, yb + 2, x, y1, 'sw-react sw-tens');
      var tx = anchor === 'end' ? x - 5 : (anchor === 'start' ? x + 5 : x);
      s += T(tx, yb + 14, [q + ' = ', N(q, v, k, lb(v))], 'sw-reactt ' + (up ? 'sw-ct' : 'sw-tt'), anchor, 12);
      return s;
    }
  }

  // ── plan ───────────────────────────────────────────────────────────────────
  // One level of SW.planModel(): the building (or the walls' box), every
  // located wall at its coordinates (north up), labels id / L / V / v_max /
  // share, a chip per multi-wall line, optional T/C at the ends, pass / fail
  // class, and the Σ wall V vs the level force in the header. Walls without
  // dir / loc_ft go in a strip under the plan. 'gov' picks the case that
  // governs v_max at most walls of the level (a tie goes to wind).
  function planSVG(plan, k, opts) {
    opts = opts || {};
    var warnings = [];
    if (!plan || !Array.isArray(plan.levels) || !plan.levels[k]) return { svg: '', warnings: ['No plan level ' + k + '.'] };
    var lv = plan.levels[k], lp = 'plan:levels.' + k;
    var ck = opts.caseKey === 'wind' || opts.caseKey === 'seismic' ? opts.caseKey : null, gov = !ck;
    if (!ck) {
      var nS = lv.walls.filter(function (w) { return w.gov.vmaxCase === 'seismic'; }).length;
      ck = nS > lv.walls.length - nS ? 'seismic' : 'wind';
    }
    // Type: wall labels FS on LH rows, end reactions FE on LHE rows.
    var cs = CASE[ck], pxW = opts.pxW > 200 ? opts.pxW : 760, M = 70, FS = 12, LH = 15, FE = 11, LHE = 13;
    var ext = plan.extents, located = lv.walls.filter(function (w) { return w.placed !== 'strip'; });
    var strip = lv.walls.filter(function (w) { return w.placed === 'strip'; });
    var out = [], hy = 22;
    // Header, flowed to the drawing width (it ran off the right edge on one line).
    out.push(T(12, hy, [lv.name + ' — plan'], 'sw-title', 'start', 17));
    var sum = lv.sum[ck];
    // Σ of the walls whose line carries an entered force vs the level force
    // (the page's Σ wall lines rule); walls that inherit the level force are
    // counted, left out, and never turn the header red. Arrays are phrases
    // flow() keeps on one line when they fit.
    var hdr = [[(gov ? 'Governing v_max case (most walls on this level): ' : 'Case: ') + cs.label + ' (' + cs.asd + '), ASD'], ' · '];
    if (sum.check) hdr.push(['Σ wall V = ', N('sumV', sum.sumV, lp + '.sum.' + ck + '.sumV', lb(sum.sumV))], ' ', ['vs level V = ', N('Vlevel', sum.Vlevel, lp + '.sum.' + ck + '.Vlevel', lb(sum.Vlevel))]);
    else hdr.push(['level V = ', N('Vlevel', sum.Vlevel, lp + '.sum.' + ck + '.Vlevel', lb(sum.Vlevel))], ' ', ['— no wall line carries its own force, no Σ check']);
    if (sum.nInherit && sum.check) hdr.push(' · ', [sum.nInherit + ' wall' + (sum.nInherit === 1 ? ' inherits' : 's inherit') + ' the level force — not in Σ']);
    if (lv.stepped && ck === 'wind') hdr.push(' ', ['(parapet steps: rows carry envelopes, Σ ≠ story total by design)']);
    var off = sum.check && Math.abs(sum.sumV - sum.Vlevel) > 0.01 * Math.max(Math.abs(sum.Vlevel), 1);
    flow(hdr, pxW - 24, 13).forEach(function (ln) { hy += 18; out.push(T(12, hy, ln, 'sw-sub' + (off ? ' sw-sum-off' : ''), 'start', 13)); });
    if (ext) {
      var bLine = plan.building
        ? [['Building B = ', N('B', plan.B_ft, 'plan:B_ft', fmt(plan.B_ft, 1) + ' ft'), ' (E–W)'], ' ', ['× D = ', N('D', plan.D_ft, 'plan:D_ft', fmt(plan.D_ft, 1) + ' ft'), ' (N–S);'], ' ', ['x from the west face, y from the south face']]
        : [['Building B × D not entered — drawn to the walls\' extent + 10 %']];
      flow(bLine, pxW - 24, 12).forEach(function (ln) { hy += 17; out.push(T(12, hy, ln, plan.building ? 'sw-dimt' : 'sw-note', 'start', 12)); });
    }
    var hdrBottom = hy + 6, PT = hy + 64;
    // Scale: the width, capped so a deep building is no taller than maxH
    // (the page passes its view height; default 1.2 × the width).
    var s = 1, planH = 0, W0 = 1, H0 = 1, maxH = opts.maxH > 100 ? opts.maxH : 1.2 * pxW;
    if (ext) {
      W0 = Math.max(ext.x1 - ext.x0, 1e-6); H0 = Math.max(ext.y1 - ext.y0, 1e-6);
      s = (pxW - 2 * M) / W0;
      if (H0 * s > maxH) s = maxH / H0;
      planH = H0 * s;
    }
    var X = function (x) { return M + (x - ext.x0) * s; }, Y = function (y) { return PT + (ext.y1 - y) * s; };

    // ── label placement ──
    // Every text box placed so far, every wall line and the compass letters
    // are obstacles; each wall tries its candidates in order (full labels,
    // then shifted, then one compact line, then the id alone) and takes the
    // first that stays inside its bounds and clear of the obstacles. What a
    // wall drops is in its hover <title>.
    var boxes = [];
    var boxOf = function (L) {
      var w = textW(L.parts, L.size), x0 = L.anchor === 'middle' ? L.x - w / 2 : (L.anchor === 'end' ? L.x - w : L.x);
      return { x0: x0 - 2, x1: x0 + w + 2, y0: L.y - L.size * 0.82 - 2, y1: L.y + L.size * 0.24 + 2 };   // 2 px clear all round
    };
    var hits = function (b, self) {
      for (var i = 0; i < boxes.length; i++) {
        var o = boxes[i];
        if (self != null && o.own === self) continue;
        if (b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0) return true;
      }
      return false;
    };
    // One candidate = lines + horizontal bounds [lo, hi]; shift (H walls)
    // slides the block along the wall to fit, strict (Y walls) refuses it.
    var fit = function (cand, self) {
      var bs = cand.lines.map(boxOf), lo = cand.lo, hi = cand.hi;
      var x0 = Math.min.apply(null, bs.map(function (b) { return b.x0; })), x1 = Math.max.apply(null, bs.map(function (b) { return b.x1; }));
      var dx = 0;
      if (x1 - x0 > hi - lo) { lo = 4; hi = pxW - 4; }
      if (x1 - x0 > hi - lo) dx = lo - x0;
      else if (x0 < lo) dx = lo - x0;
      else if (x1 > hi) dx = hi - x1;
      if (dx && cand.strict) return null;
      bs.forEach(function (b) { b.x0 += dx; b.x1 += dx; });
      for (var i = 0; i < bs.length; i++) if (hits(bs[i], self)) return null;
      return { dx: dx, bs: bs };
    };
    var place = function (cands, self, own) {
      var pick = null, f = null;
      for (var i = 0; i < cands.length && !f; i++) { f = fit(cands[i], self); if (f) pick = cands[i]; }
      if (!f) { pick = cands[cands.length - 1]; f = { dx: 0, bs: pick.lines.map(boxOf) }; }
      f.bs.forEach(function (b) { b.own = own; boxes.push(b); });
      return { tier: pick.tier, svg: pick.lines.map(function (L) { return T(L.x + f.dx, L.y, L.parts, L.cls, L.anchor, L.size); }).join('') };
    };
    boxes.push({ x0: 0, y0: 0, x1: pxW, y1: hdrBottom });

    if (ext) {
      if (plan.building) {
        var b = plan.building;
        out.push(rect(X(b.x0), Y(b.y1), (b.x1 - b.x0) * s, (b.y1 - b.y0) * s, 'sw-bldg'));
      } else {
        out.push(rect(X(ext.x0), Y(ext.y1), W0 * s, H0 * s, 'sw-bbox'));
      }
      var cx = X((ext.x0 + ext.x1) / 2), cy = Y((ext.y0 + ext.y1) / 2), rx0 = X(ext.x0), rx1 = X(ext.x1);
      var compass = [
        { x: cx, y: PT - 30, parts: ['N'], anchor: 'middle' }, { x: cx, y: Y(ext.y0) + 64, parts: ['S'], anchor: 'middle' },
        { x: rx0 - 22, y: cy + 5, parts: ['W'], anchor: 'end' }, { x: rx1 + 22, y: cy + 5, parts: ['E'], anchor: 'start' }];
      compass.forEach(function (c) { c.size = 14; c.cls = 'sw-compass'; boxes.push(boxOf(c)); out.push(T(c.x, c.y, c.parts, c.cls, c.anchor, 14)); });
      // Wall lines as obstacles (a label never sits on another wall).
      located.forEach(function (w) {
        var a = X(w.x0), bb = X(w.x1), c0 = Y(w.y0), c1 = Y(w.y1);
        boxes.push({ x0: Math.min(a, bb) - 5, x1: Math.max(a, bb) + 5, y0: Math.min(c0, c1) - 5, y1: Math.max(c0, c1) + 5, own: 'w:' + w.id });
      });
      var wallSvg = [], tiers = { full: 0, compact: 0, id: 0 };
      located.forEach(function (w) {
        var wi = lv.walls.indexOf(w), wp = lp + '.walls.' + wi, c = w.cases[ck];
        var x0 = X(w.x0), y0 = Y(w.y0), x1 = X(w.x1), y1 = Y(w.y1), horiz = w.dir === 'X';
        var l1 = [w.label + ' · L ', N('L', w.L_ft, wp + '.L_ft', fmt(w.L_ft, 1) + "'")];
        if (w.lineWalls > 1) l1.push(' · ', N('share', w.share, wp + '.share', fmt(w.share * 100, 1) + ' %'));
        var l2 = ['V ', N('V', c.V, wp + '.cases.' + ck + '.V', lb(c.V)), ' · v ', N('vmax', c.vmax, wp + '.cases.' + ck + '.vmax', plf(c.vmax))];
        var cmp = [w.label + ' · V ', N('V', c.V, wp + '.cases.' + ck + '.V', lb(c.V)), ' · v ', N('vmax', c.vmax, wp + '.cases.' + ck + '.vmax', plf(c.vmax))];
        var idl = [String(w.label)];
        var e1, e2, k1, k2, ends = [];
        if (c.ends) { e1 = c.ends[0]; e2 = c.ends[1]; k1 = wp + '.cases.' + ck + '.ends.0'; k2 = wp + '.cases.' + ck + '.ends.1'; }
        else if (c.segments && c.segments.length) {
          var last = c.segments.length - 1;
          e1 = c.segments[0].ends[0]; e2 = c.segments[last].ends[1];
          k1 = wp + '.cases.' + ck + '.segments.0.ends.0'; k2 = wp + '.cases.' + ck + '.segments.' + last + '.ends.1';
        }
        // End 1 = start_ft end: west for X walls, south for Y walls.
        if (opts.showEnds && e1 && e2) {
          ends = [['End 1: T ', N('T', e1.T, k1 + '.T', lb(e1.T)), ' / C ', N('C', e1.C, k1 + '.C', lb(e1.C))],
            ['End 2: T ', N('T', e2.T, k2 + '.T', lb(e2.T)), ' / C ', N('C', e2.C, k2 + '.C', lb(e2.C))]];
        }
        var LN = function (x, y, parts, anchor, size, cls) { return { x: x, y: y, parts: parts, anchor: anchor, size: size || FS, cls: cls || 'sw-wt' }; };
        var cands = [];
        if (horiz) {
          var xa = Math.min(x0, x1), xb = Math.max(x0, x1), xm = (xa + xb) / 2;
          var H = function (tier, x, anchor, rows) { cands.push({ tier: tier, lo: rx0 + 10, hi: rx1 - 10, lines: rows.map(function (r) { return LN(x, y0 + r[0], r[1], anchor, r[2], r[3]); }) }); };
          var full = [[-7, l1], [LH + 2, l2]].concat(ends.map(function (e, i) { return [LH + 2 + LHE * (i + 1), e, FE, 'sw-endt']; }));
          [[xm, 'middle'], [xa, 'start'], [xb, 'end']].forEach(function (p) { H('full', p[0], p[1], full); });
          // Everything above, or everything below, the line.
          var up = ends.length ? [[-7 - 2 * LHE - LH, l1], [-7 - 2 * LHE, l2], [-7 - LHE, ends[0], FE, 'sw-endt'], [-7, ends[1], FE, 'sw-endt']] : [[-7 - LH, l1], [-7, l2]];
          var dn = [[LH + 2, l1], [2 * LH + 2, l2]].concat(ends.map(function (e, i) { return [2 * LH + 2 + LHE * (i + 1), e, FE, 'sw-endt']; }));
          [[xm, 'middle'], [xa, 'start'], [xb, 'end']].forEach(function (p) { H('full', p[0], p[1], up); H('full', p[0], p[1], dn); });
          [[xm, 'middle'], [xa, 'start'], [xb, 'end']].forEach(function (p) { H('compact', p[0], p[1], [[-7, cmp]]); H('compact', p[0], p[1], [[LH + 2, cmp]]); });
          [[xm, 'middle'], [xa, 'start'], [xb, 'end']].forEach(function (p) { H('id', p[0], p[1], [[-7, idl]]); H('id', p[0], p[1], [[LH + 2, idl]]); });
          H('id', xm, 'middle', [[-7, idl]]);
        } else {
          var ya = Math.min(y0, y1), yb = Math.max(y0, y1), ym = (ya + yb) / 2;
          var V = function (tier, side, rows, inside) {
            var x = side > 0 ? x0 + 8 : x0 - 8;
            cands.push({ tier: tier, strict: true, lo: inside ? rx0 + 10 : 4, hi: inside ? rx1 - 10 : pxW - 4, lines: rows.map(function (r) { return LN(x, ym + r[0], r[1], side > 0 ? 'start' : 'end', r[2], r[3]); }) });
          };
          var fullV = [[-3, l1], [LH - 3, l2]].concat(ends.map(function (e, i) { return [LH - 3 + LHE * (i + 1), e, FE, 'sw-endt']; }));
          [true, false].forEach(function (ins) { V('full', 1, fullV, ins); V('full', -1, fullV, ins); });
          [true, false].forEach(function (ins) { V('compact', 1, [[4, cmp]], ins); V('compact', -1, [[4, cmp]], ins); });
          [true, false].forEach(function (ins) { V('id', 1, [[4, idl]], ins); V('id', -1, [[4, idl]], ins); });
          cands.push({ tier: 'id', lo: 4, hi: pxW - 4, lines: [LN(x0, ya - 7, idl, 'middle')] });
          cands.push({ tier: 'id', lo: 4, hi: pxW - 4, lines: [LN(x0, yb + LH + 1, idl, 'middle')] });
          cands.push({ tier: 'id', lo: 4, hi: pxW - 4, lines: [LN(x0 + 8, ym + 4, idl, 'start')] });
        }
        var pl = place(cands, 'w:' + w.id, 'w:' + w.id);
        tiers[pl.tier]++;
        // Hover: the whole wall, whatever the drawing had room for.
        var tip = w.label + (String(w.label) !== String(w.id) ? ' (' + w.id + ')' : '') + (w.lineWalls > 1 ? ' · line ' + w.line + ', share ' + fmt(w.share * 100, 1) + ' %' : '')
          + ' · L ' + fmt(w.L_ft, 1) + ' ft · ' + cs.asd + ': V ' + lb(c.V) + ' · v ' + plf(c.vmax)
          + (e1 && e2 ? ' · End 1 T ' + lb(e1.T) + ' / C ' + lb(e1.C) + ' · End 2 T ' + lb(e2.T) + ' / C ' + lb(e2.C) : '')
          + (w.allPass ? ' · all checks pass' : ' · a check fails') + (w.placed === 'centred' ? ' · no start_ft, centred' : '');
        var cls = 'sw-wall sw-pw ' + (w.allPass ? 'sw-pass' : 'sw-fail') + (w.placed === 'centred' ? ' sw-centred' : '');
        var g = '<g class="' + cls + '" data-wall="' + esc(w.id) + '" data-fi="' + w.fi + '" data-wi="' + w.wi + '" data-lbl="' + pl.tier + '">';
        g += '<title>' + esc(tip) + '</title>';
        g += line(x0, y0, x1, y1, 'sw-wline');
        g += line(x0 - (horiz ? 0 : 4), y0 - (horiz ? 4 : 0), x0 + (horiz ? 0 : 4), y0 + (horiz ? 4 : 0), 'sw-wend');
        g += line(x1 - (horiz ? 0 : 4), y1 - (horiz ? 4 : 0), x1 + (horiz ? 0 : 4), y1 + (horiz ? 4 : 0), 'sw-wend');
        wallSvg.push(g + pl.svg + '</g>');
      });
      // Line chips (lines of more than one wall), near the first located wall.
      lv.lines.forEach(function (ln, li) {
        if (ln.walls.length < 2) return;
        var w = located.filter(function (x) { return x.line === ln.key; })[0];
        if (!w) return;
        var chip = ['Line ' + ln.key + ': ', N('Vline', ln.V[ck], lp + '.lines.' + li + '.V.' + ck, lb(ln.V[ck]))];
        var cands = [], x0 = X(Math.min(w.x0, w.x1)), yT = Y(Math.max(w.y0, w.y1)), yB = Y(Math.min(w.y0, w.y1)), xw = X(w.x0);
        var C = function (x, y, anchor) { cands.push({ tier: 'chip', lo: 4, hi: pxW - 4, lines: [{ x: x, y: y, parts: chip, anchor: anchor, size: FS, cls: 'sw-chip' }] }); };
        if (w.dir === 'X') [-7 - LH, -7 - 2 * LH, -7 - 3 * LH, 2 * LH + 3, 3 * LH + 3].forEach(function (d) { C(x0, yT + d, 'start'); });
        else { C(xw + 8, yT - 8, 'start'); C(xw - 8, yT - 8, 'end'); C(xw + 8, yB + LH + 2, 'start'); C(xw - 8, yB + LH + 2, 'end'); }
        C(w.dir === 'X' ? x0 : xw + 8, yT - 7 - LH, 'start');
        out.push(place(cands, null, 'chip').svg);
      });
      out.push(wallSvg.join(''));
      if (tiers.compact || tiers.id) warnings.push((tiers.compact + tiers.id) + ' of ' + located.length + ' walls labelled short for want of room — hover a wall for its full data.');
    } else {
      out.push(T(M, PT, ['No wall carries a plan direction and location (dir / loc_ft) — nothing to place.'], 'sw-note', 'start', 12));
    }
    // Below the plan: the lowest label, then the dotted note and the strip.
    var yLow = boxes.reduce(function (a, bx) { return Math.max(a, bx.y1); }, ext ? PT + planH : PT);
    var yN = yLow + 20;
    if (ext && located.some(function (w) { return w.placed === 'centred'; })) { out.push(T(12, yN, ['Dotted: no start_ft — centred on the line, position not entered.'], 'sw-note', 'start', 12)); yN += 20; }
    var stripY = yN + 4, Hpx = stripY + (strip.length ? 6 + strip.length * 18 : -18) + 20;
    if (strip.length) {
      out.push(T(12, stripY, ['Not located in plan (no dir / loc_ft):'], 'sw-sub', 'start', 13));
      strip.forEach(function (w, i) {
        var wi = lv.walls.indexOf(w), wp = lp + '.walls.' + wi, c = w.cases[ck];
        out.push('<g class="sw-wall sw-strip ' + (w.allPass ? 'sw-pass' : 'sw-fail') + '" data-wall="' + esc(w.id) + '" data-fi="' + w.fi + '" data-wi="' + w.wi + '">');
        out.push(T(22, stripY + 18 * (i + 1), [w.label + ' (line ' + w.line + ') · L ', N('L', w.L_ft, wp + '.L_ft', fmt(w.L_ft, 1) + "'"), ' · V ', N('V', c.V, wp + '.cases.' + ck + '.V', lb(c.V)), ' · v ', N('vmax', c.vmax, wp + '.cases.' + ck + '.vmax', plf(c.vmax))], 'sw-wt', 'start', FS));
        out.push('</g>');
      });
    }
    var svg = svgOpen(pxW, Hpx, 'sw-plan', lv.name + ' plan', ' data-case="' + ck + '" data-fi="' + k + '"') + out.join('') + '</svg>';
    return { svg: svg, warnings: warnings, caseKey: ck };
  }

  var SWV = { elevationSVG: elevationSVG, planSVG: planSVG, esc: esc, CASE: CASE, version: '2026-09-30' };
  root.SWV = SWV;
  if (typeof module !== 'undefined' && module.exports) module.exports = SWV;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
