/* =============================================================================
   RD engine — rectangular diaphragm force distribution to shearwall lines.
   DOM-free.  window.RD.analyze(inputs) -> { wx, wy, sx, sy }.

   Shared by rectangular_diaphragm_calculator.html (the page's calcDir is this
   function) and engines/lateral-handoff.js, so the stacked shearwall import
   recomputes reactions from a saved diaphragm snapshot with the same code the
   page used to print them.

   Model: the diaphragm is a beam of span L_along carrying the uniform load
   w = V / L_along.  1 line: R = V.  2 lines: statics with overhangs (a line
   past the resultant can carry a NEGATIVE reaction — the caller decides how
   to present it; nothing is clamped here).  3+ lines: tributary widths to the
   midpoints between adjacent lines (simplified continuous beam).
   Units: V in kips, lengths in ft, reactions in kips, unit shears in kip/ft.
   ========================================================================== */
(function (root) {
  'use strict';

  var ENGINE = { name: 'rect-diaphragm', version: 1 };

  // dir: 'X' or 'Y'
  // V: total lateral force (kips)
  // L_along: diaphragm dimension along wind direction (ft)
  // B_perp: diaphragm dimension perpendicular to wind (ft) = shearwall span
  // swRows: array of {label, len, loc} for shearwall lines
  function calcDir(V, L_along, B_perp, swRows, dirLabel){
    // Distributed diaphragm load
    var w = V / L_along; // kip/ft

    // Simple beam (if 2 sw lines at 0 and L_along):
    // For arbitrary SW locations, use moment equilibrium
    // Sort by location
    var sws = swRows.map(function(r){return {label:r.label, len:r.len, loc:r.loc};});
    sws.sort(function(a,b){return a.loc-b.loc;});

    var reactions; // kips at each SW line
    if(sws.length===1){
      reactions = [V];
    } else if(sws.length===2){
      // Two-support beam with UDL, supports at arbitrary locations a and b from left
      var a=sws[0].loc, b2=sws[1].loc;
      var span=b2-a;
      // UDL from 0 to L_along with supports at a and b2
      // Sum moments about support 0 (at sws[0].loc):
      // R1*0 + R2*(b2-a) = w * (L_along centroid - a from support 0)
      // Resultant at L_along/2 from left (dist from sws[0] = L_along/2 - a)
      var R2 = w * L_along * (L_along/2 - a) / span;
      var R1 = V - R2;
      reactions = [R1, R2];
    } else {
      // Multi-support: distribute proportionally (simplified tributary)
      reactions = [];
      for(var i=0;i<sws.length;i++){
        var locPrev = i===0?0:((sws[i].loc+sws[i-1].loc)/2);
        var locNext = i===sws.length-1?L_along:((sws[i].loc+sws[i+1].loc)/2);
        reactions.push(w*(locNext-locPrev));
      }
    }

    // Unit shear at each SW line [kip/ft] = reaction / shearwall length
    var unitShears = sws.map(function(sw,i){ return reactions[i]/sw.len; });

    // ── Diaphragm chord moment & max diaphragm shear (beam analogy, UDL w over 0..L_along) ──
    var M_design, M_note, Vmax_beam;
    if(sws.length===1){
      // Single wall line — no simple-beam span; report w·L²/8 as a reference value only
      M_design = V*L_along/8;
      M_note = 'single wall line — M shown as w·L²/8 reference value; verify load path';
      Vmax_beam = V;
    } else if(sws.length===2){
      var aL=sws[0].loc, bL=sws[1].loc;
      var spanL=bL-aL;
      var R_l=reactions[0], R_r=reactions[1];
      // Positive moment: x from left support where shear = 0
      var x0 = R_l/w - aL;
      x0 = Math.max(0, Math.min(spanL, x0));
      var M_pos = R_l*x0 - w*(aL+x0)*(aL+x0)/2;
      // Negative (cantilever) moments at supports from diaphragm overhangs
      var M_negL = w*aL*aL/2;
      var M_negR = w*(L_along-bL)*(L_along-bL)/2;
      M_design = Math.max(Math.abs(M_pos), M_negL, M_negR);
      M_note = (aL<=0.001 && Math.abs(bL-L_along)<=0.001)
        ? 'M = w·L²/8 (supports at diaphragm ends)'
        : 'asymmetric wall locations — M from beam analysis incl. overhang moments';
      // Max beam shear occurs at a support face (incl. overhang shear)
      Vmax_beam = Math.max(
        Math.abs(w*aL),                      // overhang, left of support 1
        Math.abs(R_l - w*aL),                // just right of support 1
        Math.abs(R_r - w*(L_along-bL)),      // just left of support 2
        Math.abs(w*(L_along-bL))             // overhang, right of support 2
      );
    } else {
      // 3+ lines, tributary distribution: per-segment shear & per-span w·s²/8 + overhangs
      var aM=sws[0].loc, bM=sws[sws.length-1].loc;
      M_design = Math.max(w*aM*aM/2, w*(L_along-bM)*(L_along-bM)/2);
      Vmax_beam = 0;
      for(var k=0;k<sws.length;k++){
        var pm = k===0?0:((sws[k].loc+sws[k-1].loc)/2);
        var nm = k===sws.length-1?L_along:((sws[k].loc+sws[k+1].loc)/2);
        Vmax_beam = Math.max(Vmax_beam, w*(sws[k].loc-pm), w*(nm-sws[k].loc));
        if(k>0){
          var sp = sws[k].loc - sws[k-1].loc;
          M_design = Math.max(M_design, w*sp*sp/8);
        }
      }
      M_note = 'multi-line (tributary) — M = max of w·s²/8 per span + overhangs (simplified; verify with continuous-beam analysis if critical)';
    }
    var chord_T = M_design / B_perp; // kips
    var v_dia = Vmax_beam / B_perp;  // kip/ft — max diaphragm unit shear

    return {
      label: dirLabel,
      V: V,
      L_along: L_along,
      B_perp: B_perp,
      w: w,
      sws: sws,
      reactions: reactions,
      unitShears: unitShears,
      M_max: M_design,
      M_note: M_note,
      Vmax_beam: Vmax_beam,
      chord_T: chord_T,
      v_dia: v_dia
    };
  }


  // The page's calculate() wiring: Wind-X is EW wind, N/S walls (the X rows)
  // resist, the diaphragm spans D between them and B is the chord depth;
  // Wind-Y is the mirror.  Seismic reuses the geometry and is null at V = 0.
  function analyze(o) {
    var Vx = +o.Vx || 0, Vy = +o.Vy || 0, Vx_s = +o.Vx_s || 0, Vy_s = +o.Vy_s || 0;
    var B = +o.B, D = +o.D, swX = o.swX || [], swY = o.swY || [];
    return {
      wx: calcDir(Vx, D, B, swX, 'Wind-X (EW)'),
      wy: calcDir(Vy, B, D, swY, 'Wind-Y (NS)'),
      sx: Vx_s > 0 ? calcDir(Vx_s, D, B, swX, 'Seismic-X (EW)') : null,
      sy: Vy_s > 0 ? calcDir(Vy_s, B, D, swY, 'Seismic-Y (NS)') : null
    };
  }

  // Two lines at the same location give a zero lever arm (Infinity reaction).
  // Returns { ok, dupes: [loc, ...] } — the page wraps this in its alert.
  function checkSwLocs(sws) {
    var dupes = [];
    if (sws && sws.length >= 2) {
      var locs = sws.map(function (s) { return s.loc; });
      locs.forEach(function (v, i) {
        if (locs.indexOf(v) !== i && dupes.indexOf(v) < 0) dupes.push(v);
      });
    }
    return { ok: dupes.length === 0, dupes: dupes };
  }

  var RD = { ENGINE: ENGINE, calcDir: calcDir, analyze: analyze, checkSwLocs: checkSwLocs };
  root.RD = RD;
  if (typeof module !== 'undefined' && module.exports) module.exports = RD;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
