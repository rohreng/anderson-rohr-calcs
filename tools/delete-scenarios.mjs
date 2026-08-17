// =============================================================================
// Delete-a-middle-row scenarios  (PLAN.md §5 step 2)
// -----------------------------------------------------------------------------
// Count-replay cannot reproduce a deletion from the middle of a list: rebuilding
// "3 rows" regenerates rows 1,2,3 where the engineer actually has 1,3,4. So each
// scenario plants a UNIQUE SENTINEL in every row before deleting the middle one,
// and the harness asserts the surviving sentinels — never the row count. A count
// check would pass on regenerated defaults and prove nothing.
//
// Per-calc rather than a generic "click the middle ✕" driver, because the guards
// differ (roof floors cannot be removed, Remove only renders above a minimum row
// count) and a generic driver cannot plant sentinels.
//
// Each scenario returns {rowsBefore, rowsAfter, sentinels} so the harness can
// fail loudly if a renamed remove function silently no-ops.
// =============================================================================

export const SCENARIOS = {
  // ── holes + point loads, removed by id ────────────────────────────────────
  'web_opening_calculator.html': () => {
    const before = holes.length + ploads.length;
    while (holes.length < 3) addHole();
    while (ploads.length < 3) addPload();
    renderHolesTable(); renderPloadsTable();
    holes.forEach((h, i) => {
      const r = document.getElementById('hrow_' + h.id);
      if (r) r.querySelector('.hxo').value = String(101 + i);
    });
    ploads.forEach((p, i) => {
      const r = document.getElementById('prow_' + p.id);
      if (r) r.querySelector('.pPD').value = String(201 + i);
    });
    removeHole(holes[1].id);              // middle hole
    removePload(ploads[1].id);            // middle point load
    return {
      rowsBefore: 6, rowsAfter: holes.length + ploads.length,
      sentinels: holes.map((h) => (document.getElementById('hrow_' + h.id) || { querySelector: () => ({}) }).querySelector('.hxo').value)
        .concat(ploads.map((p) => document.getElementById('prow_' + p.id).querySelector('.pPD').value)),
    };
  },

  // ── story rows, removed by button ─────────────────────────────────────────
  'asce716_mwfrs_calculator.html': () => {
    const rows = () => document.getElementById('storyRows').children;
    while (rows().length < 4) addStory();
    const before = rows().length;
    Array.from(rows()).forEach((r, i) => { r.querySelector('.sh').value = String(11 + i); });
    removeStory(rows()[1].querySelector('button'));      // middle story
    return {
      rowsBefore: before, rowsAfter: rows().length,
      sentinels: Array.from(rows()).map((r) => r.querySelector('.sh').value),
    };
  },

  // ── joist rows, removed by button ─────────────────────────────────────────
  'steel_joist_selector_calculator.html': () => {
    const body = () => document.getElementById('joistTableBody');
    while (body().rows.length < 4) addJoistRow();
    const before = body().rows.length;
    Array.from(body().rows).forEach((r, i) => { r.querySelector('.span-input').value = String(31 + i); });
    removeJoistRow(body().rows[1].querySelector('.remove-btn'));   // middle joist
    return {
      rowsBefore: before, rowsAfter: body().rows.length,
      sentinels: Array.from(body().rows).map((r) => r.querySelector('.span-input').value),
    };
  },

  // ── nested: a header and a stud row inside a floor ────────────────────────
  'stacked_headers_studs_calculator.html': () => {
    const fi = 1;                                   // not the roof (guarded)
    while (floors[fi].headers.length < 3) addHeader(fi);
    render();
    const before = floors[fi].headers.length + floors[fi].studs.length;
    floors[fi].headers.forEach((h, i) => { h.w = String(41 + i); });
    floors[fi].studs.forEach((s, i) => { s.trib = String(51 + i); });
    render();
    delHeader(fi, 1);                               // middle header
    if (floors[fi].studs.length > 2) delStudRow(fi, 1);
    render();
    return {
      rowsBefore: before, rowsAfter: floors[fi].headers.length + floors[fi].studs.length,
      sentinels: floors[fi].headers.map((h) => String(h.w)).concat(floors[fi].studs.map((s) => String(s.trib))),
    };
  },

  // ── nested: a wall inside a floor, then a whole middle floor ──────────────
  'stacked_shearwall_calculator.html': () => {
    const fi = 1;
    while (floors[fi].walls.length < 3) addWall(fi);
    render();
    const count = () => floors.reduce((n, f) => n + f.walls.length, 0) + floors.length;
    const before = count();
    floors[fi].walls.forEach((w, i) => { w.L = 11 + i; });
    floors.forEach((f, i) => { f.name = 'FLR-' + i; });
    render();
    delWall(fi, 1);                                 // middle wall
    delFloor(1);                                    // middle floor
    render();
    return {
      rowsBefore: before, rowsAfter: count(),
      sentinels: floors.map((f) => f.name),
    };
  },
};

export const SCENARIO_SOURCE = Object.fromEntries(
  Object.entries(SCENARIOS).map(([k, fn]) => [k, fn.toString()])
);
