/* =============================================================================
   LH engine — are.lateral.v1 builder / parser for the lateral handoff
   MWFRS  ->  Rectangular Diaphragm  ->  Stacked Shearwall.
   DOM-free.  window.LH / module.exports.

   One versioned record serves both stages (docs/plans/2026-09-15-lateral-
   handoff-plan.md, "Data contract"):
     MWFRS stage      levels[] without walls   (LH.fromMwfrs)
     diaphragm stage  levels[] with walls      (LH.levelFromDiaphragmState +
                                                LH.assemble)
   and LH.toShearwallState turns the diaphragm-stage record into a stacked
   shearwall v2 model (one floor per level, one wall row per diaphragm line).

   Units live in the field names.  Every *_strength_* number is STRENGTH level
   in lb; an ASD diaphragm file is converted (/0.6 wind, /0.7 seismic) before
   anything is written under a strength name.  Levels are top -> bottom.
   Wall identity across levels is direction + location (id 'X@15'), never the
   label.

   Dependencies: both are resolved lazily, so each page loads only what it
   needs.  RD (engines/rect-diaphragm.js) inside levelFromDiaphragmState —
   reactions are RECOMPUTED from the snapshot's inputs with the page's own
   calcDir, never copied from rendered output; the MWFRS page loads LH without
   RD (fromMwfrs needs no engine).  SW (engines/stacked-shearwall.js) inside
   toShearwallState only: the diaphragm page loads LH without it.
   ========================================================================== */
(function (root, factory) {
  var LH = factory(root);
  root.LH = LH;
  if (typeof module !== 'undefined' && module.exports) module.exports = LH;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this), function (root) {
  'use strict';

  var ENGINE = { name: 'lateral-handoff', version: 1 };
  var SCHEMA = 'are.lateral.v1';
  var WIND_FACTOR = 0.6;    // ASCE 7-16 §2.4.1  ASD wind    = 0.6 W
  var SEIS_FACTOR = 0.7;    // ASCE 7-16 §2.4.5  ASD seismic = 0.7 E
  var LOC_TOL_FT = 0.5;     // two lines within this distance are one stacked line
  var DIA_FILE = 'rectangular_diaphragm_calculator.html';
  var DIRS = ['X', 'Y'];
  var AXES = {
    X: 'wind along EW; EW walls resist; loc_ft measured from S',
    Y: 'wind along NS; NS walls resist; loc_ft measured from W'
  };

  // ── helpers ────────────────────────────────────────────────────────────────
  function num(v, dflt) { var n = parseFloat(v); return isFinite(n) ? n : (dflt === undefined ? NaN : dflt); }
  function str(v) { return v == null ? '' : String(v); }
  function norm(s) { return str(s).trim().toLowerCase(); }
  function isBlank(s) { return str(s).trim() === ''; }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function basename(p) { return str(p).split(/[\\/]/).pop(); }
  // Stacked shearwall adapter: maxStringLength 120, stringPattern forbids < > and
  // control characters (built with fromCharCode so no control byte sits in this source).
  var UNSAFE = new RegExp('[<>' + String.fromCharCode(0) + '-' + String.fromCharCode(31) + String.fromCharCode(127) + ']', 'g');
  function safeName(p) { return basename(p).replace(UNSAFE, '').slice(0, 120); }
  function safeText(s) { return str(s).replace(UNSAFE, '').slice(0, 120); }   // wall label / floor name, same adapter rule
  function pct(a, b) { return b === 0 ? (a === 0 ? 0 : Infinity) : Math.abs(a - b) / Math.abs(b); }

  function getRD() {
    var RD = root.RD || (typeof require === 'function' ? require('./rect-diaphragm.js') : null);
    if (!RD || !RD.calcDir) throw new Error('lateral-handoff.js: RD engine (engines/rect-diaphragm.js) is not loaded.');
    return RD;
  }

  // id = dir + '@' + loc rounded to 0.1 ft, trailing-zero free: 'X@15', 'Y@45.3'.
  function wallId(dir, loc) { return dir + '@' + String(Math.round(num(loc, 0) * 10) / 10); }

  // =========================================================================
  // MWFRS stage — from the page's computed rows, not its state
  // =========================================================================
  // o = { B, D, h, hp, stories:[{label, sh}], wx:{rows}, wy:{rows}, project, meta }
  // rows[i] (asce716_mwfrs_calculator.html calcDir): label, F_net (lb, strength,
  // wall + parapet at rows[0]), F_parapet (lb, 0 when no parapet), V_cum (lb).
  function fromMwfrs(o) {
    var stories = o.stories || [], rx = (o.wx && o.wx.rows) || [], ry = (o.wy && o.wy.rows) || [];
    if (!stories.length) throw new Error('fromMwfrs: no stories.');
    if (rx.length !== stories.length || ry.length !== stories.length) {
      throw new Error('fromMwfrs: wx/wy rows (' + rx.length + '/' + ry.length + ') do not match the ' + stories.length + ' stories.');
    }
    var vcx = 0, vcy = 0, levels = [];
    for (var i = 0; i < stories.length; i++) {
      var fx = Math.round(num(rx[i].F_net, 0)), fy = Math.round(num(ry[i].F_net, 0));
      vcx += fx; vcy += fy;
      levels.push({
        index: i, label: str(stories[i].label).trim(), sh_ft: num(stories[i].sh, num(stories[i].h, null)),
        F_wind_x_strength_lb: fx, F_wind_y_strength_lb: fy,
        F_parapet_x_strength_lb: Math.round(num(rx[i].F_parapet, 0)), F_parapet_y_strength_lb: Math.round(num(ry[i].F_parapet, 0)),
        V_cum_x_strength_lb: isFinite(num(rx[i].V_cum)) ? Math.round(num(rx[i].V_cum)) : vcx,
        V_cum_y_strength_lb: isFinite(num(ry[i].V_cum)) ? Math.round(num(ry[i].V_cum)) : vcy,
        F_seis_x_strength_lb: 0, F_seis_y_strength_lb: 0
      });
    }
    return {
      schema: SCHEMA, loadLevel: 'strength', project: str(o.project),
      source: { mwfrs: o.meta || null, files: [] },
      geometry: { B_ft: num(o.B, null), D_ft: num(o.D, null), h_ft: num(o.h, null), hp_ft: num(o.hp, null) },
      axes: AXES, levels: levels
    };
  }

  // =========================================================================
  // Diaphragm stage — one saved snapshot -> one level with walls
  // =========================================================================
  // Shearwall rows from the snapshot fields: #swJSON is authoritative (every
  // file saved since Phase 0); older files carry one key per row input,
  // #swX_label_n / #swX_len_n / #swX_loc_n, numbered by a counter that was
  // never re-indexed on delete — group by n, sort by n, gaps are fine.
  function readRows(fields, warnings) {
    var raw = null;
    if (!isBlank(fields['#swJSON'])) {
      try { raw = JSON.parse(fields['#swJSON']); } catch (e) { throw new Error('#swJSON is not valid JSON.'); }
    } else {
      raw = { X: [], Y: [] };
      var byN = { X: {}, Y: {} };
      Object.keys(fields).forEach(function (k) {
        var m = /^#sw([XY])_(label|len|loc)_(\d+)$/.exec(k);
        if (!m) return;
        var slot = byN[m[1]][m[3]] = byN[m[1]][m[3]] || {};
        slot[m[2]] = fields[k];
      });
      DIRS.forEach(function (d) {
        Object.keys(byN[d]).map(Number).sort(function (a, b) { return a - b; }).forEach(function (n) { raw[d].push(byN[d][n]); });
      });
      warnings.push('No #swJSON in the file — shearwall rows rebuilt from the legacy per-row keys.');
    }
    var out = {};
    DIRS.forEach(function (d) {
      out[d] = (Array.isArray(raw[d]) ? raw[d] : []).map(function (r) {
        // Same coercion as the page's calculate(): len falls back to 1, loc to 0.
        return { label: str(r.label), len: num(r.len, 0) || 1, loc: num(r.loc, 0) || 0 };
      });
    });
    return out;
  }

  // The optional embedded story table (#mwfrsJSON): an are.lateral.v1 record.
  function readStoryTable(fields, warnings) {
    if (isBlank(fields['#mwfrsJSON'])) return null;
    var t = null;
    try { t = JSON.parse(fields['#mwfrsJSON']); } catch (e) { t = null; }
    if (!t || t.schema !== SCHEMA || !Array.isArray(t.levels)) {
      warnings.push('#mwfrsJSON is not an ' + SCHEMA + ' record — story table ignored.');
      return null;
    }
    return t;
  }

  // Reactions come back from calcDir aligned to its loc-SORTED copy of the rows;
  // map each input row to its reaction by loc (duplicates were rejected above).
  function wallsFor(dir, rows, wind, seis, warnings) {
    return rows.map(function (r) {
      var j = -1;
      for (var k = 0; k < wind.sws.length; k++) if (wind.sws[k].loc === r.loc) { j = k; break; }
      if (j < 0) throw new Error('Internal: no reaction for ' + dir + ' line "' + r.label + '" at ' + r.loc + ' ft.');
      var Rw = wind.reactions[j], Rs = seis ? seis.reactions[j] : 0;
      var w = {
        id: wallId(dir, r.loc), label: r.label, L_ft: r.len, loc_ft: r.loc,
        R_wind_strength_lb: Math.round(Math.abs(Rw) * 1000), R_seis_strength_lb: Math.round(Math.abs(Rs) * 1000)
      };
      if (Rw < 0 || Rs < 0) {
        // A line past the resultant (2-line beam with a long overhang). Wind
        // reverses, so the wall sees |R|; the sign is kept so the reader knows.
        w.sign = -1;
        warnings.push(dir + ' line "' + r.label + '" at ' + r.loc + ' ft has a negative reaction (' + fmt(Rw * 1000) + ' lb) — |R| carried; check the wall layout.');
      }
      return w;
    });
  }

  // Sum of the raw kip reactions must equal V — a guard on calcDir itself.
  function sumCheck(dirLabel, res) {
    if (!res || !(res.V > 0)) return;
    var s = res.reactions.reduce(function (a, b) { return a + b; }, 0);
    if (pct(s, res.V) > 0.001) throw new Error(dirLabel + ': sum of line reactions ' + s.toFixed(3) + ' k != V ' + res.V.toFixed(3) + ' k.');
  }

  // snapshotState = AREv2 snapshot state {calcFile, fields:{'#id': 'string'}, project, mark}
  // -> { level, storyTable|null, warnings[], B_ft, D_ft, project, loadLevel }
  function levelFromDiaphragmState(state) {
    if (!state || state.calcFile !== DIA_FILE) throw new Error('Not a diaphragm snapshot (calcFile must be ' + DIA_FILE + ').');
    var f = state.fields || {}, warnings = [];
    var label = str(f['#level']).trim();
    if (!label) throw new Error('#level is blank — name the level (Roof, 3RD, …) in the diaphragm file.');
    var B = num(f['#B']), D = num(f['#D']);
    if (!(B > 0) || !(D > 0)) throw new Error(label + ': B and D must be positive (B = ' + f['#B'] + ', D = ' + f['#D'] + ').');

    var loadLevel = norm(f['#loadLevel']);
    if (!loadLevel) { loadLevel = 'strength'; warnings.push(label + ': no #loadLevel in the file — forces taken as strength level.'); }
    if (loadLevel !== 'strength' && loadLevel !== 'asd') throw new Error(label + ': unknown #loadLevel "' + f['#loadLevel'] + '" (strength | asd).');
    var kW = loadLevel === 'asd' ? 1 / WIND_FACTOR : 1, kS = loadLevel === 'asd' ? 1 / SEIS_FACTOR : 1;
    var Vx = num(f['#Vx'], 0) * kW, Vy = num(f['#Vy'], 0) * kW;
    var Vx_s = num(f['#Vx_s'], 0) * kS, Vy_s = num(f['#Vy_s'], 0) * kS;

    var RD = getRD(), rows = readRows(f, warnings);
    DIRS.forEach(function (d) {
      var chk = RD.checkSwLocs(rows[d]);
      if (!chk.ok) throw new Error(label + ': duplicate ' + d + ' shearwall location(s) at ' + chk.dupes.join(', ') + ' ft.');
    });
    var an = RD.analyze({ B: B, D: D, Vx: Vx, Vy: Vy, Vx_s: Vx_s, Vy_s: Vy_s, swX: rows.X, swY: rows.Y });
    sumCheck(label + ' Wind-X', an.wx); sumCheck(label + ' Wind-Y', an.wy);
    sumCheck(label + ' Seismic-X', an.sx); sumCheck(label + ' Seismic-Y', an.sy);

    var level = {
      label: label,
      F_wind_x_strength_lb: Math.round(Vx * 1000), F_wind_y_strength_lb: Math.round(Vy * 1000),
      F_seis_x_strength_lb: Math.round(Vx_s * 1000), F_seis_y_strength_lb: Math.round(Vy_s * 1000),
      walls: { X: wallsFor('X', rows.X, an.wx, an.sx, warnings), Y: wallsFor('Y', rows.Y, an.wy, an.sy, warnings) }
    };
    // Two lines closer than LOC_TOL_FT on ONE level would be unified into one
    // stacked id at assembly and the second reaction silently lost — refuse.
    DIRS.forEach(function (d) {
      var ws = level.walls[d];
      for (var i = 0; i < ws.length; i++) for (var j = i + 1; j < ws.length; j++) {
        if (Math.abs(ws[i].loc_ft - ws[j].loc_ft) <= LOC_TOL_FT) {
          throw new Error(label + ': ' + d + ' lines "' + ws[i].label + '" (' + ws[i].loc_ft + ' ft) and "' + ws[j].label + '" (' + ws[j].loc_ft + ' ft) are within ' + LOC_TOL_FT + ' ft — they would stack as one line.');
        }
      }
    });

    // Cross-check against the embedded story table: a WARNING only — Nick may
    // have adjusted the level force deliberately.
    var table = readStoryTable(f, warnings);
    if (table) {
      var tl = null;
      table.levels.forEach(function (l) { if (!tl && norm(l.label) === norm(label)) tl = l; });
      if (tl) {
        [['Wind-X', 'F_wind_x_strength_lb'], ['Wind-Y', 'F_wind_y_strength_lb'], ['Seismic-X', 'F_seis_x_strength_lb'], ['Seismic-Y', 'F_seis_y_strength_lb']].forEach(function (p) {
          var mine = level[p[1]], theirs = num(tl[p[1]], 0);
          if (theirs === 0 && p[0].indexOf('Seismic') === 0) return;   // the MWFRS table carries no seismic
          if (pct(mine, theirs) > 0.005) warnings.push(label + ' ' + p[0] + ' ' + fmt(mine) + ' lb differs from the MWFRS table (' + fmt(theirs) + ' lb) by ' + (pct(mine, theirs) * 100).toFixed(1) + ' %.');
        });
      }
    }
    return { level: level, storyTable: table, warnings: warnings, B_ft: B, D_ft: D, project: str(state.project), loadLevel: loadLevel };
  }

  // =========================================================================
  // Assembly — N level results -> one diaphragm-stage record
  // =========================================================================
  // Give every wall within LOC_TOL_FT of an already-seen line (same direction)
  // that line's id, so 45 and 45.3 ft stack as one line; loc_ft is left as
  // entered.  Two walls on the SAME level may never share an id (the second
  // reaction would vanish from the stack) — that is an error, and a nonzero
  // snap across levels is reported so the reader can see what was joined.
  function unifyIds(levels, errors, warnings) {
    var seen = { X: [], Y: [] };
    levels.forEach(function (lv) {
      DIRS.forEach(function (d) {
        var assigned = {};
        lv.walls[d].forEach(function (w) {
          var hit = null;
          for (var i = 0; i < seen[d].length; i++) if (Math.abs(seen[d][i].loc - w.loc_ft) <= LOC_TOL_FT) { hit = seen[d][i]; break; }
          if (hit) {
            if (Math.abs(hit.loc - w.loc_ft) > 1e-9) warnings.push(lv.label + ' "' + w.label + '" at ' + w.loc_ft + ' ft stacked on ' + hit.id + '.');
            w.id = hit.id;
          } else {
            seen[d].push({ loc: w.loc_ft, id: w.id });
          }
          if (assigned[w.id]) errors.push(lv.label + ': ' + d + ' lines "' + assigned[w.id] + '" and "' + w.label + '" both resolve to ' + w.id + ' — lines closer than ' + LOC_TOL_FT + ' ft cannot be stacked separately.');
          else assigned[w.id] = w.label;
        });
      });
    });
  }

  // levelResults = [levelFromDiaphragmState(...)]; opts = { files:[names], heights:[ft] }
  // -> { record|null, errors[], warnings[] }
  function assemble(levelResults, opts) {
    opts = opts || {};
    var errors = [], warnings = [], results = (levelResults || []).slice();
    if (!results.length) return { record: null, errors: ['No diaphragm levels to assemble.'], warnings: warnings };
    results.forEach(function (r) { (r.warnings || []).forEach(function (w) { warnings.push(w); }); });

    // Geometry and project must agree across the files.
    var B = results[0].B_ft, D = results[0].D_ft, project = '';
    results.forEach(function (r) {
      if (Math.abs(r.B_ft - B) > 1e-9 || Math.abs(r.D_ft - D) > 1e-9) errors.push(r.level.label + ': B/D ' + r.B_ft + ' × ' + r.D_ft + ' ft differs from ' + results[0].level.label + ' (' + B + ' × ' + D + ' ft) — all levels must share the same plan.');
      if (!isBlank(r.project)) {
        if (!project) project = r.project;
        else if (norm(r.project) !== norm(project)) warnings.push(r.level.label + ': project "' + r.project + '" differs from "' + project + '".');
      }
    });
    var labels = {};
    results.forEach(function (r) {
      var k = norm(r.level.label);
      if (labels[k]) errors.push('Duplicate level label "' + r.level.label + '" — each file must name a different level.');
      labels[k] = true;
    });

    // Ordering: the first story table found in ANY file places every level by
    // its #level label; without one, the input order stands and the heights
    // must come from opts.heights (the import panel asks for them).
    var table = null, tableFrom = -1;
    results.forEach(function (r, i) { if (!table && r.storyTable) { table = r.storyTable; tableFrom = i; } });
    // Every other file's table must agree with the one used (label, sh_ft,
    // F_wind_*); a picker order that swapped them would otherwise change the
    // heights silently.
    if (table) {
      var fileName = function (i) { return opts.files && opts.files[i] ? basename(opts.files[i]) : results[i].level.label + ' file'; };
      results.forEach(function (r, i) {
        if (i === tableFrom || !r.storyTable) return;
        var diffs = [];
        if (r.storyTable.levels.length !== table.levels.length) diffs.push(r.storyTable.levels.length + ' vs ' + table.levels.length + ' levels');
        else table.levels.forEach(function (tl, k) {
          var ol = r.storyTable.levels[k];
          if (norm(ol.label) !== norm(tl.label)) diffs.push('level ' + k + ' "' + ol.label + '" vs "' + tl.label + '"');
          else if (num(ol.sh_ft, null) !== num(tl.sh_ft, null)) diffs.push(tl.label + ' sh_ft ' + ol.sh_ft + ' vs ' + tl.sh_ft);
          else if (num(ol.F_wind_x_strength_lb, 0) !== num(tl.F_wind_x_strength_lb, 0) || num(ol.F_wind_y_strength_lb, 0) !== num(tl.F_wind_y_strength_lb, 0)) diffs.push(tl.label + ' F_wind ' + ol.F_wind_x_strength_lb + '/' + ol.F_wind_y_strength_lb + ' vs ' + tl.F_wind_x_strength_lb + '/' + tl.F_wind_y_strength_lb);
        });
        if (diffs.length) warnings.push('Story table in ' + fileName(i) + ' differs from the one used (' + fileName(tableFrom) + '): ' + diffs.join('; ') + '.');
      });
    }
    var ordered = [];
    if (table) {
      var used = {};
      table.levels.forEach(function (tl) {
        var hit = null;
        results.forEach(function (r) { if (!hit && norm(r.level.label) === norm(tl.label)) hit = r; });
        if (!hit) { warnings.push(tl.label + ' not imported — story shear below it will be short.'); return; }
        used[norm(hit.level.label)] = true;
        ordered.push({ r: hit, sh_ft: num(tl.sh_ft, null), tl: tl });
      });
      results.forEach(function (r) {
        if (!used[norm(r.level.label)]) errors.push(r.level.label + ' is not in the story table (' + table.levels.map(function (l) { return l.label; }).join(', ') + ') — check #level in that file.');
      });
    } else {
      if (!opts.heights) warnings.push('no story table — heights required (no file carries #mwfrsJSON; re-send from MWFRS or enter each story height).');
      else warnings.push('no story table — using supplied heights.');
      results.forEach(function (r, i) {
        var h = opts.heights ? num(opts.heights[i], NaN) : NaN;
        ordered.push({ r: r, sh_ft: h > 0 ? h : null, tl: null });
      });
    }
    if (errors.length) return { record: null, errors: errors, warnings: warnings };

    // V_cum is re-summed from the rounded level forces, so it may differ from
    // the MWFRS page's V_cum (a sum of unrounded F_net) by <= N lb of rounding.
    var vcx = 0, vcy = 0;
    var levels = ordered.map(function (o, i) {
      var lv = JSON.parse(JSON.stringify(o.r.level));
      vcx += lv.F_wind_x_strength_lb; vcy += lv.F_wind_y_strength_lb;
      return {
        index: i, label: lv.label, sh_ft: o.sh_ft,
        F_wind_x_strength_lb: lv.F_wind_x_strength_lb, F_wind_y_strength_lb: lv.F_wind_y_strength_lb,
        F_parapet_x_strength_lb: o.tl ? num(o.tl.F_parapet_x_strength_lb, 0) : 0,
        F_parapet_y_strength_lb: o.tl ? num(o.tl.F_parapet_y_strength_lb, 0) : 0,
        V_cum_x_strength_lb: vcx, V_cum_y_strength_lb: vcy,
        F_seis_x_strength_lb: lv.F_seis_x_strength_lb, F_seis_y_strength_lb: lv.F_seis_y_strength_lb,
        walls: lv.walls
      };
    });
    unifyIds(levels, errors, warnings);
    if (errors.length) return { record: null, errors: errors, warnings: warnings };

    var record = {
      schema: SCHEMA, loadLevel: 'strength', project: project,
      source: {
        mwfrs: table && table.source ? (table.source.mwfrs || null) : null,
        files: (opts.files || []).map(safeName)
      },
      geometry: {
        B_ft: B, D_ft: D,
        h_ft: table && table.geometry ? num(table.geometry.h_ft, null) : null,
        hp_ft: table && table.geometry ? num(table.geometry.hp_ft, null) : null
      },
      axes: AXES, levels: levels
    };
    return { record: record, errors: errors, warnings: warnings };
  }

  // =========================================================================
  // Diaphragm-stage record -> stacked shearwall v2 state
  // =========================================================================
  // One floor per level (top -> bottom), one wall row per diaphragm line in the
  // chosen direction — no typical-line merge.  Every wall gets NUMERIC
  // P_wind_lb / P_seis_lb (its own line reaction; 0 when absent) so an imported
  // wall never silently inherits the level total.
  function toShearwallState(record, o) {
    o = o || {};
    var SW = root.SW || (typeof require === 'function' ? require('./stacked-shearwall.js') : null);
    if (!SW || !SW.defaultWall) throw new Error('toShearwallState: SW engine (engines/stacked-shearwall.js) is not loaded.');
    if (!record || record.schema !== SCHEMA || !Array.isArray(record.levels)) throw new Error('toShearwallState: not an ' + SCHEMA + ' record.');
    var dir = str(o.dir).toUpperCase();
    if (DIRS.indexOf(dir) < 0) throw new Error('toShearwallState: dir must be X or Y (got "' + o.dir + '").');
    var fW = 'F_wind_' + dir.toLowerCase() + '_strength_lb', fS = 'F_seis_' + dir.toLowerCase() + '_strength_lb';
    var n = record.levels.length;
    var floors = record.levels.map(function (lv, i) {
      var h = num(lv.sh_ft, NaN);
      if (!(h > 0)) throw new Error('toShearwallState: ' + lv.label + ' has no story height — heights are required for every level.');
      var isBase = i === n - 1;
      var walls = ((lv.walls && lv.walls[dir]) || []).map(function (wr) {
        var w = SW.defaultWall({
          id: wr.id, label: safeText(wr.label) || wr.id, L_ft: wr.L_ft, h_ft: h, segments_ft: [wr.L_ft], openings: [],
          sill: isBase ? 'ab58' : 'sds14', spacing: isBase ? 20 : 12
        });
        w.P_wind_lb = num(wr.R_wind_strength_lb, 0) || 0;
        w.P_seis_lb = num(wr.R_seis_strength_lb, 0) || 0;
        w.dir = dir; w.loc_ft = num(wr.loc_ft, 0);
        if (wr.sign === -1) w.sign = -1;   // past the resultant: the page's Σ wall lines sums it signed
        return w;
      });
      return { id: i + 1, name: safeText(lv.label), h_ft: h, P_wind_lb: num(lv[fW], 0) || 0, P_seis_lb: num(lv[fS], 0) || 0, walls: walls };
    });
    return {
      version: 2, sfrs: o.sfrs || 'A.15', sdc: o.sdc || 'D', species: o.species || 'DFL',
      floors: floors,
      lateral: {
        schema: SCHEMA, project: str(record.project), dir: dir,
        files: ((o.files || (record.source && record.source.files)) || []).map(safeName),
        importedAt: new Date().toISOString()
      }
    };
  }

  // =========================================================================
  // Import-panel summary — one plain-text line per level, then the warnings
  // =========================================================================
  function summarize(record, warnings) {
    var lines = [];
    (record && record.levels || []).forEach(function (lv) {
      var s = lv.label + ' — h ' + (isFinite(num(lv.sh_ft)) ? num(lv.sh_ft) + ' ft' : '?');
      ['x', 'y'].forEach(function (ax) {
        var d = ax.toUpperCase(), F = num(lv['F_wind_' + ax + '_strength_lb'], 0);
        s += ' — Wind-' + d + ' ' + fmt(F) + ' lb';
        if (lv.walls && lv.walls[d]) {
          var sum = lv.walls[d].reduce(function (a, w) { return a + (w.sign === -1 ? -1 : 1) * (num(w.R_wind_strength_lb, 0) || 0); }, 0);
          s += ' over ' + lv.walls[d].length + ' lines (Σ ' + fmt(sum) + ')';
        }
      });
      lines.push(s);
    });
    (warnings || []).forEach(function (w) { lines.push('Warning: ' + w); });
    return lines;
  }

  return {
    ENGINE: ENGINE, SCHEMA: SCHEMA, WIND_FACTOR: WIND_FACTOR, SEIS_FACTOR: SEIS_FACTOR, LOC_TOL_FT: LOC_TOL_FT, AXES: AXES,
    wallId: wallId, fromMwfrs: fromMwfrs, levelFromDiaphragmState: levelFromDiaphragmState,
    assemble: assemble, toShearwallState: toShearwallState, summarize: summarize
  };
});
