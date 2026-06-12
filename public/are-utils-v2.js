// =============================================================================
// ARE Calculator Shared Utilities — v2.0
// Save/Load · Print Summary/Full · Theme v2 · RESULTS BUS (send/import/hub)
// Usage in a calc page:
//   <script src="/are-utils-v2.js"></script>
//   AREv2.publish([{symbol:'M', label:'Max Moment', value:23.2, unit:'kip-ft', kind:'moment'}, ...]);
//   AREv2.acceptImports({moment:{field:'Mu', unit:'kip-ft'}, shear:{field:'Vu', unit:'kips'}});
// =============================================================================
(function () {
  'use strict';

  var FILE = (window.location.pathname.split('/').pop() || 'calc');
  var STORE_KEY = 'are_v1_' + FILE;            // save/load (compatible with v1 saves)
  var HUB_KEY = 'are_hub_v1';                  // published results, all calcs
  var XFER_KEY = 'are_transfer_v1';            // pending send-to payload
  var HUB_MAX = 40;

  // ── Target registry: which calcs accept which result kinds ────────────────
  // field = input id on the target page. Add entries as calcs adopt v2.
  var TARGETS = {
    moment: [
      { file: 'W_beam_to_HSS_column_calculator.html', slug: 'w-to-hss-column', label: 'W-Beam to HSS Column', field: 'Mu', unit: 'kip-ft' },
      { file: 'large_moment_base_plate.html', slug: 'large-moment-base-plate', label: 'Large Moment Base Plate', field: 'deadMoment', unit: 'kip-ft' },
      { file: 'through_plate_calculator.html', slug: 'through-plate', label: 'Through-Plate Connection', field: 'momentDeadRight', unit: 'kip-ft' }
    ],
    shear: [
      { file: 'web_stiffener_calculator.html', slug: 'web-stiffener', label: 'Web Stiffener Design', field: 'Vu', unit: 'kips' }
    ],
    axial: [
      { file: 'large_moment_base_plate.html', slug: 'large-moment-base-plate', label: 'Large Moment Base Plate', field: 'deadLoad', unit: 'kips' }
    ],
    reaction: [
      { file: 'large_moment_base_plate.html', slug: 'large-moment-base-plate', label: 'Large Moment Base Plate', field: 'deadLoad', unit: 'kips' }
    ],
    lineload: [
      { file: 'masonry_lintel_jamb_calculator.html', slug: 'masonry-lintel-jamb', label: 'Masonry Lintel + Jamb', field: 'w_load', unit: 'lb/ft' }
    ]
  };

  // ── Theme injection ────────────────────────────────────────────────────────
  function injectTheme() {
    if (document.getElementById('are-theme-v2')) return;
    var l = document.createElement('link');
    l.id = 'are-theme-v2'; l.rel = 'stylesheet';
    l.href = (location.protocol === 'file:' ? '' : '/') + 'are-theme-v2.css';
    document.head.appendChild(l);
    var f = document.createElement('link');
    f.rel = 'stylesheet';
    f.href = 'https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap';
    document.head.appendChild(f);
  }

  // ── Toolbar (Save/Load/Print) — same contract as v1 ──────────────────────
  function injectToolbar() {
    if (document.getElementById('areBar')) return;
    var bar = document.createElement('div');
    bar.className = 'are-bar'; bar.id = 'areBar';
    bar.innerHTML =
      '<label for="areJob">Project</label>' +
      '<input class="are-bar-job" id="areJob" type="text" placeholder="e.g. 2024-012 · Col C3" />' +
      '<div class="are-bar-sep"></div>' +
      '<button class="are-btn" onclick="areSave()">&#128190; Save</button>' +
      '<button class="are-btn" onclick="areLoad()">&#128194; Load</button>' +
      '<div class="are-spacer"></div>' +
      '<button class="are-btn pr" onclick="arePrint(\'s\')">&#128424; Summary</button>' +
      '<button class="are-btn pr" onclick="arePrint(\'f\')">&#128196; Full Calc</button>';
    document.body.insertBefore(bar, document.body.firstChild);
    var ph = document.createElement('div');
    ph.className = 'are-ph'; ph.id = 'arePH';
    ph.innerHTML = '<div class="are-ph-title">' + document.title + '</div><div class="are-ph-meta" id="arePHmeta"></div>';
    bar.insertAdjacentElement('afterend', ph);
    var toast = document.createElement('div');
    toast.className = 'are-toast'; toast.id = 'areToast';
    document.body.appendChild(toast);
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved) { var d = JSON.parse(saved); if (d._job) document.getElementById('areJob').value = d._job; }
    } catch (e) {}
  }

  function showToast(msg, ms) {
    var el = document.getElementById('areToast'); if (!el) return;
    el.textContent = msg; el.classList.add('show');
    clearTimeout(el._t); el._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2800);
  }

  window.areSave = function () {
    var jobEl = document.getElementById('areJob');
    var job = jobEl ? jobEl.value.trim() : '';
    var inputs = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
      if (el.id === 'areJob' || el.type === 'file') return;
      inputs[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ _job: job, _ts: Date.now(), _inputs: inputs }));
      showToast('✓ Saved' + (job ? ' — ' + job : ''));
    } catch (e) { showToast('⚠ Save failed.'); }
  };

  window.areLoad = function () {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) { showToast('No saved inputs found for this calculator.', 3200); return; }
    var data; try { data = JSON.parse(raw); } catch (e) { showToast('⚠ Could not read saved data.'); return; }
    var jobEl = document.getElementById('areJob');
    if (jobEl && data._job) jobEl.value = data._job;
    Object.keys(data._inputs || {}).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      if (el.type === 'checkbox') el.checked = !!data._inputs[id]; else el.value = data._inputs[id];
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    autoRun();
    var d = new Date(data._ts);
    showToast('✓ Loaded' + (data._job ? ' — ' + data._job : '') + '  (saved ' + d.toLocaleDateString() + ')');
  };

  function autoRun() {
    if (typeof window.runCalcs === 'function') window.runCalcs();
    else if (typeof window.runAll === 'function') window.runAll();
    else if (typeof window.calculate === 'function') window.calculate();
    else if (typeof window.calcAll === 'function') window.calcAll();
    else if (typeof window.runCalc === 'function') window.runCalc();
  }

  window.arePrint = function (mode) {
    var metaEl = document.getElementById('arePHmeta');
    if (metaEl) {
      var jobEl = document.getElementById('areJob');
      var jobStr = (jobEl && jobEl.value.trim()) ? jobEl.value.trim() + '  ·  ' : '';
      metaEl.textContent = jobStr + 'Anderson Rohr Engineers  ·  ' + new Date().toLocaleDateString();
    }
    if (mode === 'f') {
      document.querySelectorAll('.det-row').forEach(function (el) { el.style.setProperty('display', 'table-row', 'important'); });
      document.querySelectorAll('.calc-det').forEach(function (el) { el.style.setProperty('display', 'block', 'important'); });
    }
    document.body.setAttribute('data-pm', mode);
    window.print();
    document.body.removeAttribute('data-pm');
    if (mode === 'f') {
      document.querySelectorAll('.det-row').forEach(function (el) { el.style.removeProperty('display'); });
      document.querySelectorAll('.calc-det').forEach(function (el) { el.style.removeProperty('display'); });
    }
  };

  // Minimal print-mode rules (v1 parity) injected as style
  function injectPrintRules() {
    if (document.getElementById('are-print-v2')) return;
    var css = '@media print{.are-bar{display:none!important}button,.calc-btn,.det-btn{display:none!important}' +
      '.are-ph{display:block!important;border-bottom:2px solid #1a2b5f;padding-bottom:8px;margin-bottom:14px}' +
      '.are-ph-title{font-size:15px;font-weight:700;color:#1a2b5f}.are-ph-meta{font-size:11px;color:#555}' +
      '.results,.results-section{display:block!important}' +
      'body[data-pm="s"] .blk{display:none!important}body[data-pm="s"] .dem-grid{display:none!important}' +
      'body[data-pm="s"] .det-row{display:none!important}body[data-pm="s"] .chk-table{display:table!important}' +
      'body[data-pm="s"] .summary{display:block!important}body[data-pm="s"] #sumBox{display:block!important}' +
      'body[data-pm="f"] .det-row{display:table-row!important}body[data-pm="f"] .calc-det{display:block!important}' +
      '@page{margin:.75in;size:letter portrait}}' +
      '.are-ph{display:none}';
    var el = document.createElement('style'); el.id = 'are-print-v2'; el.textContent = css;
    document.head.appendChild(el);
  }

  // ── RESULTS BUS ────────────────────────────────────────────────────────────
  function hubRead() {
    try { return JSON.parse(localStorage.getItem(HUB_KEY) || '[]'); } catch (e) { return []; }
  }
  function hubWrite(list) {
    try { localStorage.setItem(HUB_KEY, JSON.stringify(list.slice(0, HUB_MAX))); } catch (e) {}
  }

  // publish([{symbol,label,value,unit,kind}]) — call after every calc run
  window.AREv2 = window.AREv2 || {};
  AREv2.publish = function (results) {
    if (!results || !results.length) return;
    var jobEl = document.getElementById('areJob');
    var job = jobEl ? jobEl.value.trim() : '';
    var list = hubRead();
    results.forEach(function (r) {
      if (r.value === undefined || r.value === null || !isFinite(r.value)) return;
      var key = FILE + '|' + r.symbol;
      list = list.filter(function (e) { return e.key !== key; });
      list.unshift({
        key: key, file: FILE, calc: document.title, job: job,
        symbol: r.symbol, label: r.label || r.symbol,
        value: Math.round(r.value * 1000) / 1000, unit: r.unit || '', kind: r.kind || 'other',
        ts: Date.now()
      });
    });
    hubWrite(list);
    renderResultsBar(results);
    renderHubBody();
  };

  // ── Results bar with Send-to chips ────────────────────────────────────────
  var lastResults = [];
  function renderResultsBar(results) {
    lastResults = results;
    var host = document.getElementById('areResultsBar');
    if (!host) {
      host = document.createElement('div');
      host.className = 'are-results-bar'; host.id = 'areResultsBar';
      // place after summary box if present, else before results, else end of container
      var anchor = document.getElementById('sumBox') || document.querySelector('.summary') ||
                   document.getElementById('results') || document.querySelector('.container') || document.body;
      anchor.insertAdjacentElement('afterend', host);
    }
    var h = '<span class="rb-title">⇄ Results</span>';
    results.forEach(function (r, i) {
      if (r.value === undefined || !isFinite(r.value)) return;
      var hasTargets = (TARGETS[r.kind] || []).filter(function (t) { return t.file !== FILE; }).length > 0;
      h += '<span class="are-chip">' + (r.label || r.symbol) + ': <span class="cv">' +
        (Math.round(r.value * 100) / 100).toLocaleString() + '</span> <span class="cu">' + (r.unit || '') + '</span>' +
        (hasTargets ? '<button title="Send to another calc" onclick="AREv2._menu(event,' + i + ')">→</button>' : '') +
        '</span>';
    });
    host.innerHTML = h;
  }

  AREv2._menu = function (ev, idx) {
    ev.stopPropagation();
    closeMenu();
    var r = lastResults[idx]; if (!r) return;
    var targets = (TARGETS[r.kind] || []).filter(function (t) { return t.file !== FILE; });
    if (!targets.length) return;
    var m = document.createElement('div');
    m.className = 'are-send-menu'; m.id = 'areSendMenu';
    var h = '<div class="sm-hd">Send ' + (r.label || r.symbol) + ' = ' + r.value + ' ' + (r.unit || '') + ' to…</div>';
    targets.forEach(function (t, j) {
      h += '<a onclick="AREv2._send(' + idx + ',' + j + ')">' + t.label + ' <span style="color:#9aa7c2">(' + t.field + ')</span></a>';
    });
    m.innerHTML = h;
    document.body.appendChild(m);
    var rect = ev.target.getBoundingClientRect();
    m.style.left = Math.min(rect.left, window.innerWidth - 250) + 'px';
    m.style.top = (rect.bottom + 6 + window.scrollY) + 'px';
    setTimeout(function () { document.addEventListener('click', closeMenu, { once: true }); }, 0);
  };
  function closeMenu() { var m = document.getElementById('areSendMenu'); if (m) m.remove(); }

  AREv2._send = function (idx, j) {
    var r = lastResults[idx]; if (!r) return;
    var t = (TARGETS[r.kind] || []).filter(function (x) { return x.file !== FILE; })[j];
    if (!t) return;
    sendTo(t, r.value, r.label || r.symbol, r.unit);
  };

  function sendTo(t, value, label, unit) {
    try {
      localStorage.setItem(XFER_KEY, JSON.stringify({
        file: t.file, fields: [{ id: t.field, value: value }],
        fromCalc: document.title, fromLabel: label, unit: unit || '', ts: Date.now()
      }));
    } catch (e) { return; }
    closeMenu();
    var url = '/calcs/' + t.slug;
    try {
      if (window.top !== window.self) window.top.location.href = url;   // inside shell iframe
      else if (location.protocol === 'file:') showToast('✓ Queued for ' + t.label + ' — open it on the website.');
      else window.location.href = url;
    } catch (e) { window.open(url, '_blank'); }
  }

  // direct send from hub rows into THIS calc
  var importMap = {};   // kind -> {field, unit}
  AREv2.acceptImports = function (map) { importMap = map || {}; renderHubBody(); };

  function applyTransferIfAny() {
    var raw; try { raw = localStorage.getItem(XFER_KEY); } catch (e) { return; }
    if (!raw) return;
    var x; try { x = JSON.parse(raw); } catch (e) { localStorage.removeItem(XFER_KEY); return; }
    if (x.file !== FILE) return;                       // not for this calc
    if (Date.now() - x.ts > 10 * 60 * 1000) { localStorage.removeItem(XFER_KEY); return; }  // stale
    localStorage.removeItem(XFER_KEY);
    var applied = 0;
    (x.fields || []).forEach(function (f) {
      var el = document.getElementById(f.id); if (!el) return;
      el.value = f.value;
      el.classList.add('are-imported');
      setTimeout(function () { el.classList.remove('are-imported'); }, 6000);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      applied++;
    });
    if (applied) {
      autoRun();
      showToast('✓ Imported ' + (x.fromLabel || 'value') + ' from ' + (x.fromCalc || 'another calc'), 4200);
    }
  }

  // ── Hub drawer ────────────────────────────────────────────────────────────
  function injectHub() {
    if (document.getElementById('areHub')) return;
    var fab = document.createElement('button');
    fab.className = 'are-hub-fab'; fab.id = 'areHubFab';
    fab.innerHTML = '⇄ Results Hub';
    fab.onclick = function () { document.getElementById('areHub').classList.toggle('open'); renderHubBody(); };
    document.body.appendChild(fab);
    var hub = document.createElement('div');
    hub.className = 'are-hub'; hub.id = 'areHub';
    hub.innerHTML = '<div class="are-hub-hd"><b>⇄ Results Hub</b>' +
      '<button onclick="document.getElementById(\'areHub\').classList.remove(\'open\')">×</button></div>' +
      '<div class="are-hub-bd" id="areHubBd"></div>';
    document.body.appendChild(hub);
  }

  function renderHubBody() {
    var bd = document.getElementById('areHubBd'); if (!bd) return;
    var list = hubRead();
    if (!list.length) { bd.innerHTML = '<div class="are-hub-empty">No published results yet.<br>Run a v2 calculator and its key results will appear here.</div>'; return; }
    var h = '';
    list.forEach(function (e, i) {
      var canUse = importMap[e.kind] && e.file !== FILE;
      h += '<div class="are-hub-row">' +
        '<div class="hr-top"><span class="hr-lbl">' + e.label + '</span>' +
        '<span class="hr-val">' + e.value.toLocaleString() + ' <small>' + e.unit + '</small></span></div>' +
        '<div class="hr-src">' + e.calc + (e.job ? ' · ' + e.job : '') + ' · ' + new Date(e.ts).toLocaleDateString() + '</div>' +
        '<div class="hr-actions">' +
        (canUse ? '<button onclick="AREv2._use(' + i + ')">⤓ Use here (' + importMap[e.kind].field + ')</button>' : '') +
        '<button onclick="AREv2._copy(' + i + ')">Copy</button>' +
        '</div></div>';
    });
    bd.innerHTML = h;
  }

  AREv2._use = function (i) {
    var e = hubRead()[i]; if (!e) return;
    var im = importMap[e.kind]; if (!im) return;
    var el = document.getElementById(im.field); if (!el) return;
    el.value = e.value;
    el.classList.add('are-imported');
    setTimeout(function () { el.classList.remove('are-imported'); }, 6000);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    autoRun();
    document.getElementById('areHub').classList.remove('open');
    showToast('✓ Inserted ' + e.label + ' = ' + e.value + ' ' + e.unit, 3600);
  };

  AREv2._copy = function (i) {
    var e = hubRead()[i]; if (!e) return;
    try { navigator.clipboard.writeText(String(e.value)); showToast('✓ Copied ' + e.value); } catch (err) {}
  };

  AREv2.sendToTarget = sendTo;     // for custom per-calc send buttons
  AREv2.targets = TARGETS;

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectTheme();
    injectPrintRules();
    injectToolbar();
    injectHub();
    applyTransferIfAny();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
