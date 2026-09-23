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

   Titleblock (additive, record.titleblock = {projectName, jobNumber,
   engineer, date}, every string through safeText): senders ALWAYS emit it —
   MWFRS from its Project Information fields, the diaphragm stage from its own
   #projName/#projEng/#projDate merged over the embedded #mwfrsJSON titleblock
   (first non-blank per key wins; a differing non-blank name/job/engineer is a
   warning).  Receivers fill BLANK fields only, never overwrite.  Old readers
   check only schema + levels[], so they ignore it.

   Parapet steps (docs/plans/2026-09-23-parapet-steps-plan.md + -api.md,
   additive, no schema bump): MWFRS stage adds geometry.hp_typ_ft / roofType /
   theta_deg and a top-level parapet block.  A diaphragm level with active
   steps (LH.parapetFromFields) carries, per stepped direction, F_wind = the
   max physical-case total, F_parapet_step_*, cases_* (signed reactions per
   wall id) and per-wall envelope magnitudes with sign_wind / case_wind /
   sign_seis, plus a level parapet block.  Unstepped levels are unchanged.
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
  var STEP_LEVEL_KEYS = ['F_parapet_step_x_strength_lb', 'F_parapet_step_y_strength_lb', 'cases_x', 'cases_y', 'parapet'];
  var AXES = {
    X: 'Wind-X: wind E–W, normal to the E and W faces; resisted by the N and S shearwalls (EW walls); loc_ft from S',
    Y: 'Wind-Y: wind N–S, normal to the N and S faces; resisted by the E and W shearwalls (NS walls); loc_ft from W'
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

  // ── titleblock ─────────────────────────────────────────────────────────────
  var TB_KEYS = ['projectName', 'jobNumber', 'engineer', 'date'];
  var TB_NAMES = { projectName: 'project name', jobNumber: 'job no.', engineer: 'engineer', date: 'date' };
  // o = {projectName, jobNumber, engineer, date} (any may be missing) -> all four keys, sanitized strings.
  function titleblock(o) {
    o = o || {};
    var t = {};
    TB_KEYS.forEach(function (k) { t[k] = safeText(str(o[k]).trim()).trim(); });
    return t;
  }
  // list = [titleblock|null, ...] in precedence order -> one titleblock.  First
  // non-blank per key wins; a later non-blank that differs (case-insensitive)
  // is a warning.  Dates are not compared: each calc is dated when it is run.
  // where (optional) prefixes the warning, e.g. the level label.
  function mergeTitleblock(list, warnings, where) {
    var out = titleblock(null);
    (list || []).forEach(function (tb) {
      if (!tb) return;
      tb = titleblock(tb);
      TB_KEYS.forEach(function (k) {
        if (isBlank(tb[k])) return;
        if (isBlank(out[k])) { out[k] = tb[k]; return; }
        if (k !== 'date' && norm(tb[k]) !== norm(out[k]) && warnings) {
          warnings.push((where ? where + ': ' : '') + 'titleblock ' + TB_NAMES[k] + ' "' + tb[k] + '" differs from "' + out[k] + '" — kept "' + out[k] + '".');
        }
      });
    });
    return out;
  }

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
  // o = { B, D, h, hp, hpTyp, roofType, theta, parapet, stories:[{label, sh}],
  //       wx:{rows}, wy:{rows}, project, titleblock, meta }
  // rows[i] (asce716_mwfrs_calculator.html calcDir): label, F_net (lb, strength,
  // wall + parapet at rows[0]), F_parapet (lb, 0 when no parapet), V_cum (lb).
  // Parapet steps (plan 2026-09-23, additive): geometry.hp_typ_ft / roofType /
  // theta_deg and the top-level parapet block, null when absent.
  var PARAPET_KEYS = ['hp_max_ft', 'hp_typ_ft', 'z_p_ft', 'qp_psf', 'GCpn_ww', 'GCpn_lw', 'pp_ww_psf', 'pp_lw_psf', 'pp_net_psf', 'w_typ_plf', 'roofType', 'roof_theta_deg', 'roofFlat'];
  function safeNum(v) { if (v === null || v === undefined || v === '') return null; var n = num(v, null); return n === null || !isFinite(n) ? null : n; }
  function safeStr(v) { return v == null ? null : safeText(v); }
  // MWFRS parapet block -> safe copy (numbers finite or null, roofType a safe
  // string, roofFlat a boolean or null); null when there is none.
  function safeParapet(p) {
    if (!p || typeof p !== 'object') return null;
    var out = {};
    PARAPET_KEYS.forEach(function (k) {
      if (k === 'roofType') out[k] = safeStr(p[k]);
      else if (k === 'roofFlat') out[k] = p[k] === true ? true : (p[k] === false ? false : null);
      else out[k] = safeNum(p[k]);
    });
    return out;
  }
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
      schema: SCHEMA, loadLevel: 'strength', project: str(o.project), titleblock: titleblock(o.titleblock),
      source: { mwfrs: o.meta || null, files: [] },
      geometry: {
        B_ft: num(o.B, null), D_ft: num(o.D, null), h_ft: num(o.h, null), hp_ft: num(o.hp, null),
        hp_typ_ft: safeNum(o.hpTyp), roofType: safeStr(o.roofType), theta_deg: safeNum(o.theta)
      },
      axes: AXES, levels: levels, parapet: safeParapet(o.parapet)
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
  // A stepped direction (RD v2, res.stepped) is checked PER PHYSICAL CASE
  // (plan R12): each case is in equilibrium; the per-wall envelope is design
  // demand with no equilibrium claim and is never summed here.
  function sumCheck(dirLabel, res) {
    if (res && res.stepped) {
      (res.cases || []).forEach(function (c) { sumCheck(dirLabel + ' (' + c.id + ')', c); });
      return;
    }
    if (!res || !(res.V > 0)) return;
    var s = res.reactions.reduce(function (a, b) { return a + b; }, 0);
    if (pct(s, res.V) > 0.001) throw new Error(dirLabel + ': sum of line reactions ' + s.toFixed(3) + ' k != V ' + res.V.toFixed(3) + ' k.');
  }

  // ── stepped parapets (plan 2026-09-23, R2/R4/R12/R13/R20) ──────────────────
  // AREv2 snapshots store a checkbox as a boolean (are-utils-v2 fieldValue);
  // strings are accepted too for hand-built / older states.
  function flag(v) { return v === true || v === 1 || /^(true|on|checked|1|yes)$/i.test(str(v).trim()); }
  function optNum(v) { return isBlank(v) ? null : num(v, null); }
  // Snapshot fields (or the page's own live values in the same shape) ->
  // RD.analyze parapet, or null when the level has no steps (#stepsAtLevel
  // not 'on', #stepJSON blank / []) so unstepped pages analyze exactly as
  // before.  Shared by the Diaphragm page's calculate() and
  // levelFromDiaphragmState, so both build it identically.  asdFactor is left
  // to the caller (page display only).  Throws on malformed #stepJSON.
  function parapetFromFields(f) {
    f = f || {};
    if (norm(f['#stepsAtLevel']) !== 'on') return null;
    var raw = str(f['#stepJSON']).trim(), steps;
    if (!raw) return null;
    try { steps = JSON.parse(raw); } catch (e) { throw new Error('#stepJSON is not valid JSON.'); }
    if (!Array.isArray(steps)) throw new Error('#stepJSON must be an array of parapet steps.');
    if (!steps.length) return null;
    var roof = norm(f['#ppRoof']);
    return {
      qp_psf: num(f['#ppQp'], NaN), GCpn_ww: 1.5, GCpn_lw: 1.0,
      h_typ_ft: optNum(f['#ppHtyp']), h_max_ft: optNum(f['#ppHmax']),
      commonBase: flag(f['#ppCommonBase']),
      roofFlat: roof === 'flat' ? true : (roof === 'sloped' ? false : null),
      steps: steps.map(function (s) {
        s = s || {};
        var o = { label: str(s.label), face: str(s.face).trim().toUpperCase(), start_ft: num(s.start_ft, 0), width_ft: num(s.width_ft, 0), h_ft: num(s.h_ft, 0) };
        if (s.active === false) o.active = false;
        return o;
      })
    };
  }

  function lb(k) { return Math.round(k * 1000); }
  // Stepped direction -> per-wall envelope rows.  Envelope magnitude (>= 0)
  // is the wall's line force; sign_wind / case_wind say which physical case
  // governs; sign_seis is the seismic reaction's own sign.  Legacy `sign`
  // (read by older Shearwall pages) = the wind sign.
  function wallsForStepped(dir, rows, wind, seis, warnings) {
    var env = wind.envelope.reactions;
    return rows.map(function (r) {
      var e = null, j = -1;
      for (var k = 0; k < env.length; k++) if (env[k].loc === r.loc) { e = env[k]; break; }
      if (!e) throw new Error('Internal: no enveloped reaction for ' + dir + ' line "' + r.label + '" at ' + r.loc + ' ft.');
      if (seis) for (k = 0; k < seis.sws.length; k++) if (seis.sws[k].loc === r.loc) { j = k; break; }
      var Rs = seis && j >= 0 ? seis.reactions[j] : 0;
      var w = {
        id: wallId(dir, r.loc), label: r.label, L_ft: r.len, loc_ft: r.loc,
        R_wind_strength_lb: lb(Math.abs(e.abs)), R_seis_strength_lb: lb(Math.abs(Rs)),
        sign_wind: e.sign === -1 ? -1 : 1, case_wind: (e.governing_cases || []).join(','), sign_seis: Rs < 0 ? -1 : 1
      };
      if (w.sign_wind === -1) {
        w.sign = -1;
        warnings.push(dir + ' line "' + r.label + '" at ' + r.loc + ' ft has a negative wind reaction (' + fmt(-w.R_wind_strength_lb) + ' lb, case ' + w.case_wind + ') — |R| carried; check the wall layout.');
      }
      if (w.sign_seis === -1) warnings.push(dir + ' line "' + r.label + '" at ' + r.loc + ' ft has a negative seismic reaction (' + fmt(Rs * 1000) + ' lb) — |R| carried; check the wall layout.');
      return w;
    });
  }
  // Stepped direction -> the carried physical cases, signed per wall id.
  function casesOut(dir, rows, wind) {
    return wind.cases.map(function (c) {
      var reactions = {};
      rows.forEach(function (r) {
        for (var k = 0; k < c.sws.length; k++) if (c.sws[k].loc === r.loc) { reactions[wallId(dir, r.loc)] = lb(c.reactions[k]); break; }
      });
      return { id: c.id, total_lb: lb(c.V), reactions: reactions };
    });
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
    // Stepped parapets: q_p is strength, so the steps are always analyzed at
    // asdFactor 1 on top of the strength-converted baseline (plan R4).  A
    // fatal validation (R20: sloped roof, common base unconfirmed, step above
    // h_p,max, one line, ...) blocks every handoff path — throw.
    var parapet = parapetFromFields(f);
    if (parapet) parapet.asdFactor = 1;
    var an = RD.analyze({ B: B, D: D, Vx: Vx, Vy: Vy, Vx_s: Vx_s, Vy_s: Vy_s, swX: rows.X, swY: rows.Y, parapet: parapet });
    if (an.fatal) throw new Error(label + ': stepped parapets cannot be analyzed — ' + an.fatal.join(' '));
    sumCheck(label + ' Wind-X', an.wx); sumCheck(label + ' Wind-Y', an.wy);
    sumCheck(label + ' Seismic-X', an.sx); sumCheck(label + ' Seismic-Y', an.sy);

    var wx = an.wx, wy = an.wy;
    var level = {
      label: label,
      F_wind_x_strength_lb: wx.stepped ? lb(wx.envelope.V_total.value) : Math.round(Vx * 1000),
      F_wind_y_strength_lb: wy.stepped ? lb(wy.envelope.V_total.value) : Math.round(Vy * 1000),
      F_seis_x_strength_lb: Math.round(Vx_s * 1000), F_seis_y_strength_lb: Math.round(Vy_s * 1000),
      walls: {
        X: wx.stepped ? wallsForStepped('X', rows.X, wx, an.sx, warnings) : wallsFor('X', rows.X, wx, an.sx, warnings),
        Y: wy.stepped ? wallsForStepped('Y', rows.Y, wy, an.sy, warnings) : wallsFor('Y', rows.Y, wy, an.sy, warnings)
      }
    };
    // Stepped directions only — an unstepped level keeps exactly today's keys.
    // F_wind = the governing (max) case total; F_parapet_step = F_wind − the
    // UDL baseline; cases carry each physical case's signed reactions.
    [['x', wx, Vx, rows.X], ['y', wy, Vy, rows.Y]].forEach(function (p) {
      if (!p[1].stepped) return;
      level['F_parapet_step_' + p[0] + '_strength_lb'] = level['F_wind_' + p[0] + '_strength_lb'] - Math.round(p[2] * 1000);
      level['cases_' + p[0]] = casesOut(p[0].toUpperCase(), p[3], p[1]);
    });
    if (an.parapet && an.parapet.anyActive) {
      var ap = an.parapet;
      level.parapet = {
        qp_psf: ap.qp_psf, GCpn_ww: ap.GCpn_ww, GCpn_lw: ap.GCpn_lw, h_typ_ft: ap.h_typ_ft, h_max_ft: ap.h_max_ft,
        steps: ap.steps.map(function (s) {
          return { label: safeText(s.label), face: s.face, dir: s.dir, start_ft: s.start_ft, width_ft: s.width_ft, h_ft: s.h_ft,
            dh_ft: s.dh_ft, x_ft: s.x_ft, F_ww_lb: lb(s.F_ww_k), F_lw_lb: lb(s.F_lw_k), active: !!s.active };
        })
      };
    }
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
        // The MWFRS table has no steps: compare the UDL baseline (F_wind −
        // F_parapet_step), so a stepped level does not warn on its own steps.
        [['Wind-X', 'F_wind_x_strength_lb'], ['Wind-Y', 'F_wind_y_strength_lb'], ['Seismic-X', 'F_seis_x_strength_lb'], ['Seismic-Y', 'F_seis_y_strength_lb']].forEach(function (p) {
          var stepKey = p[1].replace('F_wind_', 'F_parapet_step_');
          var mine = level[p[1]] - (p[1] !== stepKey ? num(level[stepKey], 0) : 0), theirs = num(tl[p[1]], 0);
          if (theirs === 0 && p[0].indexOf('Seismic') === 0) return;   // the MWFRS table carries no seismic
          if (pct(mine, theirs) > 0.005) warnings.push(label + ' ' + p[0] + ' ' + fmt(mine) + ' lb differs from the MWFRS table (' + fmt(theirs) + ' lb) by ' + (pct(mine, theirs) * 100).toFixed(1) + ' %.');
        });
      }
    }
    // Titleblock: this page's own fields first, then the MWFRS table's (job no. lives only there).
    var tb = mergeTitleblock([
      { projectName: f['#projName'], engineer: f['#projEng'], date: f['#projDate'] },
      table ? table.titleblock : null
    ], warnings, label);
    return { level: level, storyTable: table, warnings: warnings, B_ft: B, D_ft: D, project: str(state.project), titleblock: tb, loadLevel: loadLevel };
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
      var out = {
        index: i, label: lv.label, sh_ft: o.sh_ft,
        F_wind_x_strength_lb: lv.F_wind_x_strength_lb, F_wind_y_strength_lb: lv.F_wind_y_strength_lb,
        F_parapet_x_strength_lb: o.tl ? num(o.tl.F_parapet_x_strength_lb, 0) : 0,
        F_parapet_y_strength_lb: o.tl ? num(o.tl.F_parapet_y_strength_lb, 0) : 0,
        V_cum_x_strength_lb: vcx, V_cum_y_strength_lb: vcy,
        F_seis_x_strength_lb: lv.F_seis_x_strength_lb, F_seis_y_strength_lb: lv.F_seis_y_strength_lb,
        walls: lv.walls
      };
      // Parapet-step keys (plan R5), copied explicitly and only when present,
      // so an unstepped level assembles exactly as before.  Per-wall envelope
      // metadata (sign_wind / case_wind / sign_seis) rides inside walls.
      STEP_LEVEL_KEYS.forEach(function (k) { if (Object.prototype.hasOwnProperty.call(lv, k)) out[k] = lv[k]; });
      return out;
    });
    // unifyIds may move a wall onto a stacked id; the carried cases are keyed
    // by wall id, so remap them with it.
    levels.forEach(function (lv) { DIRS.forEach(function (d) { lv.walls[d].forEach(function (w) { w.__oid = w.id; }); }); });
    unifyIds(levels, errors, warnings);
    levels.forEach(function (lv) {
      DIRS.forEach(function (d) {
        var map = {};
        lv.walls[d].forEach(function (w) { map[w.__oid] = w.id; delete w.__oid; });
        (lv['cases_' + d.toLowerCase()] || []).forEach(function (c) {
          var r = {};
          Object.keys(c.reactions || {}).forEach(function (id) { r[map[id] || id] = c.reactions[id]; });
          c.reactions = r;
        });
      });
    });
    if (errors.length) return { record: null, errors: errors, warnings: warnings };

    // Titleblock across levels, in the caller's file order (results without one — hand-built — are skipped).
    var tb = mergeTitleblock(results.map(function (r) { return r.titleblock || null; }), warnings);
    var record = {
      schema: SCHEMA, loadLevel: 'strength', project: project, titleblock: tb,
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
    // MWFRS parapet keys (plan R5): carried when the story table has them
    // (an older table leaves the record exactly as before).
    var own = function (o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); };
    if (table && table.geometry) {
      if (own(table.geometry, 'hp_typ_ft')) record.geometry.hp_typ_ft = safeNum(table.geometry.hp_typ_ft);
      if (own(table.geometry, 'roofType')) record.geometry.roofType = safeStr(table.geometry.roofType);
      if (own(table.geometry, 'theta_deg')) record.geometry.theta_deg = safeNum(table.geometry.theta_deg);
    }
    if (own(table, 'parapet')) record.parapet = safeParapet(table.parapet);
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
        // Stepped parapets: envelope magnitude above, sign / governing case as metadata only.
        if (wr.sign_wind === -1 || wr.sign_wind === 1) w.sign_wind = wr.sign_wind;
        if (typeof wr.case_wind === 'string') w.case_wind = safeText(wr.case_wind);
        if (wr.sign_seis === -1 || wr.sign_seis === 1) w.sign_seis = wr.sign_seis;
        return w;
      });
      var fl = { id: i + 1, name: safeText(lv.label), h_ft: h, P_wind_lb: num(lv[fW], 0) || 0, P_seis_lb: num(lv[fS], 0) || 0, walls: walls };
      // Stepped level in this direction: carry the physical cases (signed
      // per wall id) and the imported envelope, so the Shearwall page can
      // check each case's Σ and detect later edits (plan R13 / R17).
      var cases = lv['cases_' + dir.toLowerCase()];
      if (Array.isArray(cases) && cases.length) {
        var imported = {};
        walls.forEach(function (w) { imported[w.id] = w.P_wind_lb; });
        fl.lh = {
          dir: dir, P_wind_lb: fl.P_wind_lb,
          F_parapet_step_lb: num(lv['F_parapet_step_' + dir.toLowerCase() + '_strength_lb'], 0) || 0,
          imported: imported,
          cases: cases.map(function (c) {
            var r = {};
            Object.keys((c && c.reactions) || {}).forEach(function (id) { r[safeText(id)] = num(c.reactions[id], 0) || 0; });
            return { id: safeText(c && c.id), total_lb: num(c && c.total_lb, 0) || 0, reactions: r };
          })
        };
      }
      return fl;
    });
    return {
      version: 2, sfrs: o.sfrs || 'A.15', sdc: o.sdc || 'D', species: o.species || 'DFL',
      floors: floors,
      lateral: {
        schema: SCHEMA, project: str(record.project), dir: dir,
        // Metadata only (no field ids); re-sanitized because the record may come from storage.
        titleblock: record.titleblock ? titleblock(record.titleblock) : null,
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
        var cases = lv['cases_' + ax];
        if (Array.isArray(cases) && cases.length) {
          // Stepped: F is the governing case total; walls are enveloped, so
          // their Σ is not the story total — list each case's own Σ instead.
          var gov = cases.filter(function (c) { return num(c.total_lb, 0) === F; }).map(function (c) { return c.id; });
          s += ' incl. parapet steps ' + fmt(num(lv['F_parapet_step_' + ax + '_strength_lb'], 0)) + ' lb (max case ' + gov.join('/') + ')';
          if (lv.walls && lv.walls[d]) {
            s += ' over ' + lv.walls[d].length + ' lines, enveloped per wall (' + cases.map(function (c) {
              var cs = Object.keys(c.reactions || {}).reduce(function (a, k) { return a + (num(c.reactions[k], 0) || 0); }, 0);
              return c.id + ' Σ ' + fmt(cs) + ' of ' + fmt(num(c.total_lb, 0));
            }).join('; ') + ')';
          }
          return;
        }
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
    wallId: wallId, fromMwfrs: fromMwfrs, levelFromDiaphragmState: levelFromDiaphragmState, parapetFromFields: parapetFromFields,
    assemble: assemble, toShearwallState: toShearwallState, summarize: summarize,
    titleblock: titleblock, mergeTitleblock: mergeTitleblock, safeText: safeText
  };
});
