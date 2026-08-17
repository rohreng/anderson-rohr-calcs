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

  // ── HSS connection family (chooser banner) ────────────────────────────────
  var HSS_FAMILY = [
    'HSS_to_HSS_branch_connection_calculator.html',
    'W_beam_to_HSS_column_calculator.html',
    'through_plate_calculator.html',
    'directly_welded_HSS_connection_calculator.html',
    'hss_connection_complete_calculator.html'
  ];
  var CALC_SLUG_MAP = {
    'HSS_to_HSS_branch_connection_calculator.html':   'hss-to-hss-branch',
    'W_beam_to_HSS_column_calculator.html':           'w-to-hss-column',
    'through_plate_calculator.html':                  'through-plate',
    'directly_welded_HSS_connection_calculator.html': 'directly-welded-hss',
    'hss_connection_complete_calculator.html':        'hss-connection-complete'
  };

  // ── Theme injection ────────────────────────────────────────────────────────
  // Calcs on the older are-calc.css look opt OUT with:
  //     <script src="/are-utils-v2.js" data-no-theme></script>
  // They still get the toolbar (styled by the minimal CSS below), but keep their
  // own appearance — are-theme-v2.css uses !important input sizing that would
  // otherwise restyle them.
  function themeOptedOut() {
    var s = document.querySelector('script[src*="are-utils-v2.js"]');
    return !!(s && s.hasAttribute('data-no-theme'));
  }

  var MINIMAL_BAR_CSS =
    '.are-bar{position:sticky;top:0;z-index:9999;display:flex;align-items:center;gap:6px;flex-wrap:wrap;' +
    'padding:7px 10px;background:#f7f8fb;border-bottom:1px solid #d8dced;font:13px/1.3 system-ui,Segoe UI,sans-serif}' +
    '.are-bar label{font-size:11px;font-weight:700;color:#1e3c72;letter-spacing:.03em}' +
    '.are-bar-job{min-width:210px;padding:4px 7px;border:1px solid #c3cade;border-radius:4px;font:inherit}' +
    '.are-bar-sep{width:1px;height:20px;background:#d8dced}' +
    '.are-spacer{flex:1}' +
    '.are-btn{padding:4px 10px;border:1px solid #c3cade;border-radius:4px;background:#fff;color:#1e3c72;' +
    'font:inherit;cursor:pointer}' +
    '.are-btn:hover:not(:disabled){background:#eef1f8}' +
    '.are-btn:disabled{opacity:.45;cursor:not-allowed}' +
    '.are-ph{display:none}' +
    '.are-toast{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:10000;max-width:80vw;' +
    'padding:9px 14px;border-radius:6px;background:#12203f;color:#fff;font:13px/1.4 system-ui,sans-serif;' +
    'box-shadow:0 6px 20px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .18s}' +
    '.are-toast.show{opacity:1}' +
    '@media print{.are-bar{display:none!important}}';

  function injectTheme() {
    if (themeOptedOut()) {
      if (document.getElementById('are-bar-min')) return;
      var s = document.createElement('style');
      s.id = 'are-bar-min';
      s.textContent = MINIMAL_BAR_CSS;
      document.head.appendChild(s);
      return;
    }
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
      '<button class="are-btn" id="areSaveBtn" onclick="areSave(\'f\')" disabled>&#128190; Save</button>' +
      '<button class="are-btn" id="areSaveAsBtn" onclick="areSaveAs(\'f\')" title="Save to a different folder">&#8230;</button>' +
      '<button class="are-btn" id="areLoadBtn" onclick="areLoad()">&#128194; Load</button>' +
      '<div class="are-spacer"></div>' +
      '<button class="are-btn pr" onclick="arePrint(\'s\')">&#128424; Summary</button>' +
      '<button class="are-btn pr" onclick="arePrint(\'f\')">&#128196; Full Calc</button>' +
      '<button class="are-btn" onclick="AREv2.expandAll()" title="Expand all calc details">&#8862; Expand All</button>' +
      '<button class="are-btn" onclick="AREv2.collapseAll()" title="Collapse all calc details">&#8861; Collapse</button>';
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

  // ── LEGACY BRIDGE (one release only) ──────────────────────────────────────
  // The old localStorage save was per-browser, per-machine, and incomplete (it
  // only saw [id] elements, so dynamic rows were silently dropped). It is
  // replaced by the file-based snapshot below. This reader stays for one
  // release so nobody loses in-flight work saved under the old mechanism.
  window.areLoadLocalLegacy = function () {
    var raw = null;
    try { raw = localStorage.getItem(STORE_KEY); } catch (e) {}
    if (!raw) { showToast('No old browser-local save found for this calculator.', 3600); return; }
    var data; try { data = JSON.parse(raw); } catch (e) { showToast('⚠ Could not read the old save.'); return; }
    var jobEl = document.getElementById('areJob');
    if (jobEl && data._job) jobEl.value = data._job;
    var n = 0;
    Object.keys(data._inputs || {}).forEach(function (id) {
      var el = document.getElementById(id); if (!el) return;
      if (el.type === 'checkbox') el.checked = !!data._inputs[id]; else el.value = data._inputs[id];
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      n++;
    });
    autoRun();
    var d = new Date(data._ts);
    showToast('✓ Loaded ' + n + ' fields from the old browser-local save (' + d.toLocaleDateString() +
              '). Save to a project file to keep it.', 6000);
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

  // ── UX unification API (v2.1) ──────────────────────────────────────────────
  // Default toggleDet so every calc gets expandable rows for free
  if (typeof window.toggleDet !== 'function') {
    window.toggleDet = function (i) {
      var el = document.getElementById('det_' + i);
      var b = document.getElementById('dbtn_' + i);
      if (!el) return;
      var open = el.classList.toggle('open');
      if (b) b.textContent = open ? '▾ Calc' : '▸ Calc';
    };
  }
  AREv2.expandAll = function () {
    document.querySelectorAll('.calc-det').forEach(function (el) { el.classList.add('open'); });
    document.querySelectorAll('.det-row').forEach(function (el) { el.style.setProperty('display','table-row','important'); });
    document.querySelectorAll('.det-btn').forEach(function (b) { b.textContent = '▾ Calc'; });
    document.querySelectorAll('.step-card').forEach(function (c) { c.classList.add('open'); });
  };
  AREv2.collapseAll = function () {
    document.querySelectorAll('.calc-det').forEach(function (el) { el.classList.remove('open'); });
    document.querySelectorAll('.det-row').forEach(function (el) { el.style.removeProperty('display'); });
    document.querySelectorAll('.det-btn').forEach(function (b) { b.textContent = '▸ Calc'; });
    document.querySelectorAll('.step-card').forEach(function (c) { c.classList.remove('open'); });
  };

  // Member-select normalization: short designation in the box, full props in
  // option.title + live .member-hint line below (fixes clipped text)
  AREv2.normalizeSelects = function (selEl) {
    if (!selEl) { document.querySelectorAll('select.member-select').forEach(function(s){ AREv2.normalizeSelects(s); }); return; }
    Array.prototype.forEach.call(selEl.options, function (opt) {
      if (!opt.title) opt.title = opt.textContent;
      var m = opt.textContent.match(/^([A-Za-z0-9X×\/\-\.]+)/);
      if (m && m[1].length < opt.textContent.length) opt.textContent = m[1];
    });
    if (!selEl._areHintWired) {
      selEl._areHintWired = true;
      selEl.addEventListener('change', function () {
        var wrap = selEl.closest('.ig') || selEl.parentElement;
        var hint = wrap ? wrap.querySelector('.member-hint') : null;
        if (!hint && wrap) { hint = document.createElement('span'); hint.className='member-hint'; selEl.insertAdjacentElement('afterend', hint); }
        var o = selEl.options[selEl.selectedIndex];
        if (hint) hint.textContent = o ? (o.title || '') : '';
      });
    }
    selEl.dispatchEvent(new Event('change'));
  };

  // Canonical SVG building blocks (arrow conventions: red=applied INTO member,
  // navy=reaction AWAY, green=dimension both-ends, red arc=moment +CW)
  AREv2.svgDefs = function (prefix) {
    prefix = prefix || '';
    return '<defs>'
      + '<marker id="'+prefix+'aLoad" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4z" fill="#c42b2b"/></marker>'
      + '<marker id="'+prefix+'aReact" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4z" fill="#2e4a8a"/></marker>'
      + '<marker id="'+prefix+'aDim" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L0,7 L7,3.5z" fill="#1a7a4a"/></marker>'
      + '<marker id="'+prefix+'aMom" markerWidth="9" markerHeight="9" refX="4" refY="4" orient="auto"><path d="M0,0 L0,8 L8,4z" fill="#c42b2b"/></marker>'
      + '<pattern id="'+prefix+'gndHatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">'
      +   '<line x1="0" y1="0" x2="0" y2="8" stroke="#0f1a3a" stroke-width="1.2" opacity="0.5"/>'
      + '</pattern>'
      + '</defs>';
  };
  AREv2.svgGround = function (x, y, width, prefix) {
    prefix = prefix || '';
    return '<line x1="'+(x-width/2)+'" y1="'+y+'" x2="'+(x+width/2)+'" y2="'+y+'" stroke="#0f1a3a" stroke-width="2.5"/>'
         + '<rect x="'+(x-width/2)+'" y="'+y+'" width="'+width+'" height="12" fill="url(#'+prefix+'gndHatch)"/>';
  };
  AREv2.svgWSection = function (cx, cy, d, bf, tf, tw, sc) {
    var D=d*sc, B=bf*sc, T=Math.max(tf*sc,2), W=Math.max(tw*sc,2);
    var x=cx-B/2, y=cy-D/2;
    return '<path d="M'+x+','+y+' h'+B+' v'+T+' h-'+((B-W)/2)+' v'+(D-2*T)+' h'+((B-W)/2)+' v'+T+' h-'+B+' v-'+T+' h'+((B-W)/2)+' v-'+(D-2*T)+' h-'+((B-W)/2)+' z" fill="#fde68a" stroke="#92400e" stroke-width="1.5"/>';
  };
  AREv2.svgWeld = function (x1,y1,x2,y2) {
    var dx=x2-x1, dy=y2-y1, L=Math.sqrt(dx*dx+dy*dy)||1, n=Math.max(2,Math.floor(L/5)), s='';
    for (var i=0;i<=n;i++){ var t=i/n, px=x1+dx*t, py=y1+dy*t;
      s+='<line x1="'+(px-2.5)+'" y1="'+(py+2.5)+'" x2="'+(px+2.5)+'" y2="'+(py-2.5)+'" stroke="#92400e" stroke-width="1.3"/>'; }
    return s;
  };
  AREv2.svgBolt = function (cx,cy,r) {
    return '<circle cx="'+cx+'" cy="'+cy+'" r="'+r+'" fill="#6b7a96" stroke="#374151" stroke-width="1"/>'
         + '<circle cx="'+cx+'" cy="'+cy+'" r="'+(r*0.4)+'" fill="#374151"/>';
  };

  // ── HSS connection chooser banner ─────────────────────────────────────────
  AREv2._hssToggle = function () {
    var body = document.getElementById('ahcBody');
    var btn = document.getElementById('ahcToggle');
    if (!body) return;
    var open = body.style.display === 'none';
    body.style.display = open ? 'block' : 'none';
    if (btn) btn.classList.toggle('open', open);
  };
  function injectHSSChooser () {
    if (HSS_FAMILY.indexOf(FILE) === -1) return;
    if (document.getElementById('areHSSChooser')) return;
    var html = ''
      + '<button class="ahc-toggle" id="ahcToggle" onclick="AREv2._hssToggle()">'
      + 'ⓘ HSS Connection Guide — not sure which calc to use? <span class="ahc-arrow">▸</span></button>'
      + '<div class="ahc-body" id="ahcBody" style="display:none">'
      + '<div class="ahc-q">What are you designing?</div>'
      + '<div class="ahc-branch"><div class="ahc-label">Truss / bracing — branch loaded axially, no moment transfer (AISC Ch. K, DG24 Ch. 8–9)</div>'
      + '<a class="ahc-link" href="/calcs/hss-to-hss-branch" target="_top">HSS-to-HSS Branch (T/Y/X)</a></div>'
      + '<div class="ahc-branch"><div class="ahc-label">W-beam moment connection, flanges welded directly to the HSS column face — want the COMPLETE limit-state suite (local yielding + punching + sidewall)</div>'
      + '<a class="ahc-link" href="/calcs/hss-connection-complete" target="_top">HSS Connection — Complete Checks</a></div>'
      + '<div class="ahc-branch"><div class="ahc-label">Same directly-welded connection — quick chord-wall local yielding check only (DG24 Ex 4.3, Eq. K1-7)</div>'
      + '<a class="ahc-link" href="/calcs/w-to-hss-column" target="_top">W-Beam to HSS Column</a> &nbsp;·&nbsp; '
      + '<a class="ahc-link" href="/calcs/directly-welded-hss" target="_top">Directly Welded W to HSS (React)</a></div>'
      + '<div class="ahc-branch"><div class="ahc-label">Bolted FR moment connection — plates pass THROUGH the HSS column (DG24 Ex 4.2)</div>'
      + '<a class="ahc-link" href="/calcs/through-plate" target="_top">Through-Plate Moment Connection</a></div>'
      + '<div class="ahc-branch"><div class="ahc-label">HSS column base on concrete — not an HSS-to-HSS connection</div>'
      + '<a class="ahc-link" href="/calcs/base-plate-v1" target="_top">Single Base Plate</a> &nbsp;·&nbsp; '
      + '<a class="ahc-link" href="/calcs/large-moment-base-plate" target="_top">Large Moment Base Plate</a></div>'
      + '</div>';
    var div = document.createElement('div');
    div.className = 'are-hss-chooser'; div.id = 'areHSSChooser';
    div.innerHTML = html;
    var slug = CALC_SLUG_MAP[FILE];
    if (slug) {
      var cur = div.querySelector('a[href="/calcs/'+slug+'"]');
      if (cur) { cur.className += ' ahc-current'; cur.innerHTML += ' ← you are here'; }
    }
    var bar = document.getElementById('areBar');
    if (bar) bar.insertAdjacentElement('afterend', div);
    else document.body.insertBefore(div, document.body.firstChild);
  }

  // ===========================================================================
  // SNAPSHOT / RESTORE  (PLAN.md §1–§3)
  // ---------------------------------------------------------------------------
  // Save produces ONE self-contained .html file written into the project folder
  // on OneDrive. That file is both the printable record (frozen post-run DOM,
  // scripts stripped, CSS inlined) and the reloadable input set (state embedded
  // as inert JSON). No server, no database.
  // ===========================================================================

  var SNAP_SCHEMA = 'are.snapshot.v1';
  var STATE_EL_ID = 'are-state';
  var SNAP_WRAP_CLASS = 'are-snapshot-content';
  var MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024;

  // ── Adapter registry (Tier B) ─────────────────────────────────────────────
  // A model-driven calc registers one of these. The model is authoritative for
  // everything under ownedFields; generic capture ignores those subtrees.
  var adapter = null;
  AREv2.registerAdapter = function (a) {
    if (!a || typeof a.getModel !== 'function' || typeof a.setModel !== 'function') {
      throw new Error('[are] registerAdapter requires getModel() and setModel()');
    }
    adapter = a;
    adapter.version = a.version || 1;
    adapter.ownedFields = a.ownedFields || [];
    readyDeclared = true;
    if (a.ready && typeof a.ready.then === 'function') {
      calcReady = false;
      a.ready.then(function () { calcReady = true; refreshToolbarState(); },
                   function () { calcReady = true; refreshToolbarState(); });
    } else {
      calcReady = true;
    }
    refreshToolbarState();
    return adapter;
  };
  AREv2.getAdapter = function () { return adapter; };

  // ── Readiness (PLAN.md §1) ────────────────────────────────────────────────
  // A promise's settled state cannot be read synchronously, and the Save click
  // handler must do zero awaiting before it opens a picker. So readiness is
  // tracked as plain booleans set by .then() during init.
  var calcReady = false;
  var destinationReady = false;
  var readyDeclared = false;      // did the calc take responsibility for readiness?

  // Calcs with async data (SheetJS workbooks, the shapes JSON) call this.
  // Safe to call BEFORE this script loads via the queue in the snippet below —
  // script order across 55 hand-written files is not something to rely on.
  AREv2.ready = function (promise) {
    readyDeclared = true;
    calcReady = false;
    refreshToolbarState();
    Promise.resolve(promise).then(function () { calcReady = true; refreshToolbarState(); },
                                  function () { calcReady = true; refreshToolbarState(); });
  };

  // Drain anything queued before this file executed:
  //   window.AREv2 = window.AREv2 || {}; (AREv2._q = AREv2._q || []).push(promise);
  if (AREv2._q && AREv2._q.length) {
    AREv2._q.forEach(function (p) { AREv2.ready(p); });
    AREv2._q.length = 0;
  }
  AREv2.isReady = function () { return calcReady; };

  /**
   * Declare readiness by polling a predicate — for calcs that populate controls
   * asynchronously without exposing a promise (the AISC workbook loaders fire
   * `load` + setTimeout and hand back nothing to await).
   *
   * FAILS OPEN: if the predicate never becomes true within timeoutMs, the calc
   * is marked ready anyway. A permanently-disabled Save button because a shape
   * database 404'd would be a worse outcome than saving without it.
   */
  AREv2.readyWhen = function (predicate, timeoutMs) {
    var limit = timeoutMs || 20000;
    AREv2.ready(new Promise(function (resolve) {
      var t0 = Date.now();
      (function poll() {
        var done = false;
        try { done = !!predicate(); } catch (e) { done = false; }
        if (done || Date.now() - t0 > limit) return resolve();
        setTimeout(poll, 100);
      })();
    }));
  };

  // ── Restore transaction ───────────────────────────────────────────────────
  // Suppression means "do not re-render / re-calculate" — NOT "do not run
  // handlers". Some calcs maintain model state inside change handlers
  // (stacked_headers_studs keeps LV[k] there), so blocking handlers wholesale
  // would leave the model stale.
  var restoring = false;
  AREv2.isRestoring = function () { return restoring; };
  AREv2.beginRestore = function () { restoring = true; };
  AREv2.endRestore = function () { restoring = false; };

  // Calcs whose UI has derived state that plain input/change events do not
  // rebuild (enable/disable groups, dependent visibility) register a refresher
  // here instead of monkey-patching window.areLoad.
  var afterRestoreHooks = [];
  AREv2.onAfterRestore = function (fn) {
    if (typeof fn === 'function') afterRestoreHooks.push(fn);
  };
  function fireAfterRestore() {
    afterRestoreHooks.forEach(function (fn) {
      try { fn(); } catch (e) { if (window.console) console.warn('[are] onAfterRestore hook failed', e); }
    });
  }

  // A calculator that throws — usually input validation, e.g. composite stud
  // blockout rejecting a non-integer stud count — must NOT block Save. The
  // engineer still needs to record and re-load what they entered, and refusing
  // to save because the numbers are mid-edit would be its own defect. The error
  // is logged, not swallowed silently.
  function runAndSettle() {
    try {
      if (adapter && typeof adapter.runAndSettle === 'function') {
        return Promise.resolve(adapter.runAndSettle())
          .catch(function (e) { if (window.console) console.warn('[are] calc failed during settle', e); })
          .then(waitForQuietDom);
      }
      autoRun();
    } catch (e) {
      if (window.console) console.warn('[are] calc failed during settle', e);
    }
    return waitForQuietDom();
  }
  AREv2.runAndSettle = runAndSettle;

  // Frame-based quiet detection is too short: this codebase has redraw timers at
  // 250ms (channel_joist_bearing), 80ms (masonry_anchor) and 50ms (snow_load).
  // Wait for a genuinely quiet window longer than the longest known timer.
  var QUIET_MS = 400;
  var QUIET_TIMEOUT_MS = 5000;
  function waitForQuietDom() {
    return new Promise(function (resolve) {
      var timer = null, done = false;
      var obs = new MutationObserver(function () {
        if (done) return;
        clearTimeout(timer);
        timer = setTimeout(finish, QUIET_MS);
      });
      function finish() {
        if (done) return;
        done = true;
        clearTimeout(timer);
        clearTimeout(hard);
        obs.disconnect();
        resolve();
      }
      var hard = setTimeout(finish, QUIET_TIMEOUT_MS);
      obs.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
      timer = setTimeout(finish, QUIET_MS);
    });
  }

  // ── Field predicate + keys (Tier A) ───────────────────────────────────────
  function ownedSelectors() {
    return (adapter && adapter.ownedFields) || [];
  }
  function isOwnedByModel(el) {
    var sels = ownedSelectors();
    for (var i = 0; i < sels.length; i++) {
      try { if (el.closest(sels[i])) return true; } catch (e) {}
    }
    return false;
  }

  // ONE predicate, used by capture, by lookup, and by BOTH directions of the
  // mismatch diff. Asymmetry here would report a mismatch on every normal load.
  // NOTE on disabled/readOnly: these are captured, NOT excluded. Many calcs
  // enable a field conditionally (deep_beam_stm's #tieN / #tieSize follow a mode
  // toggle). Excluding them makes the persistable SET a function of transient UI
  // state, so a file saved in one mode spuriously fails the mismatch gate when
  // reloaded in another. Markup changes are rare; UI-state changes are constant.
  // They are captured for a stable key set and restored by value only, without
  // events — see isDerivedField.
  function isPersistableField(el) {
    if (!el || !el.tagName) return false;
    var tag = el.tagName.toLowerCase();
    if (tag !== 'input' && tag !== 'select' && tag !== 'textarea') return false;
    if (el.type === 'file' || el.type === 'button' || el.type === 'submit' || el.type === 'reset') return false;
    if (el.id === 'areJob') return false;                       // carried as metadata
    if (el.closest('.are-bar, .are-hub, .are-results-bar, .are-send-menu, .are-hss-chooser')) return false;
    if (el.closest('.' + SNAP_WRAP_CLASS + '-controls')) return false;
    if (el.hasAttribute('data-are-ignore')) return false;
    if (isOwnedByModel(el)) return false;                       // the model owns it
    return true;
  }
  AREv2._isPersistableField = isPersistableField;

  // Derived/echoed fields: captured so the key set stays stable, but restored by
  // value only. Firing input/change on a disabled output can re-enter a calc's
  // own handlers with a value it is about to recompute anyway.
  function isDerivedField(el) {
    return !!(el.disabled || el.readOnly);
  }

  function cssEscape(s) {
    return (window.CSS && CSS.escape) ? CSS.escape(s) : String(s).replace(/([^\w-])/g, '\\$1');
  }

  function nthOfType(el) {
    var i = 1, sib = el;
    while ((sib = sib.previousElementSibling)) {
      if (sib.tagName === el.tagName) i++;
    }
    return i;
  }

  // #id  ->  name[i]  ->  structural path from the nearest ancestor with an id.
  function fieldKey(el) {
    if (el.id) return '#' + cssEscape(el.id);

    if (el.name) {
      var group = document.getElementsByName(el.name);
      var idx = Array.prototype.indexOf.call(group, el);
      if (idx >= 0) return 'name:' + el.name + '[' + idx + ']';
    }

    var parts = [];
    var node = el;
    while (node && node !== document.body) {
      if (node.id) { parts.unshift('#' + cssEscape(node.id)); break; }
      parts.unshift(node.tagName.toLowerCase() + ':nth-of-type(' + nthOfType(node) + ')');
      node = node.parentElement;
    }
    return 'path:' + parts.join('>');
  }

  function resolveKey(key) {
    try {
      if (key.charAt(0) === '#') return document.querySelectorAll(key);
      if (key.indexOf('name:') === 0) {
        var m = key.match(/^name:(.*)\[(\d+)\]$/);
        if (!m) return [];
        var group = document.getElementsByName(m[1]);
        var el = group[Number(m[2])];
        return el ? [el] : [];
      }
      if (key.indexOf('path:') === 0) return document.querySelectorAll(key.slice(5));
    } catch (e) {}
    return [];
  }

  function fieldValue(el) {
    if (el.type === 'checkbox' || el.type === 'radio') return !!el.checked;
    return el.value;
  }

  function allPersistableFields() {
    var out = [];
    document.querySelectorAll('input, select, textarea').forEach(function (el) {
      if (isPersistableField(el)) out.push(el);
    });
    return out;
  }

  // Capture fails closed: an ambiguous key means the snapshot could restore into
  // the wrong control, which is worse than refusing to save.
  function captureFields() {
    var fields = {}, problems = [];
    allPersistableFields().forEach(function (el) {
      var key = fieldKey(el);
      if (Object.prototype.hasOwnProperty.call(fields, key)) {
        problems.push('duplicate key "' + key + '"');
        return;
      }
      var hits = resolveKey(key);
      if (hits.length !== 1 || hits[0] !== el) {
        problems.push('key "' + key + '" resolves to ' + hits.length + ' elements');
        return;
      }
      fields[key] = fieldValue(el);
    });
    return { fields: fields, problems: problems };
  }

  // A shape hash over the field keys + adapter version. This replaces PLAN's
  // "content hash of the calc file": it needs no network fetch and it tracks the
  // thing that actually governs whether an old file can still load. Like the
  // file hash it was to replace, it WARNS — it never rejects.
  function shapeHash(fields) {
    var keys = Object.keys(fields).sort().join('|') + '|adapter=' + (adapter ? adapter.version : 0);
    var h = 5381;
    for (var i = 0; i < keys.length; i++) h = ((h * 33) ^ keys.charCodeAt(i)) >>> 0;
    return h.toString(16);
  }

  AREv2.captureState = function () {
    var cap = captureFields();
    var jobEl = document.getElementById('areJob');
    return {
      schema: SNAP_SCHEMA,
      calcFile: FILE,
      calcTitle: document.title,
      adapterVersion: adapter ? adapter.version : 0,
      shapeHash: shapeHash(cap.fields),
      project: jobEl ? jobEl.value.trim() : '',
      savedAt: new Date().toISOString(),
      fields: cap.fields,
      model: adapter ? adapter.getModel() : null,
      _problems: cap.problems
    };
  };

  // ── Snapshot construction ─────────────────────────────────────────────────

  function sameOriginHref(href) {
    try { return new URL(href, location.href).origin === location.origin; } catch (e) { return false; }
  }

  // Read CSS text out of the live stylesheets, recursing into @import rules.
  // are-calc.css:11,17 imports two EXTERNAL font sheets — those are dropped, not
  // followed, or the saved file would hit the network when opened offline.
  function collectCssText(sheet, acc, depth) {
    if (depth > 6) return;
    var rules;
    try { rules = sheet.cssRules; } catch (e) { acc.failed.push(sheet.href || '(inaccessible sheet)'); return; }
    if (!rules) return;
    for (var i = 0; i < rules.length; i++) {
      var rule = rules[i];
      if (rule.type === 3 /* CSSImportRule */) {
        var href = rule.href ? new URL(rule.href, sheet.href || location.href).href : '';
        if (href && !sameOriginHref(href)) { acc.droppedImports.push(href); continue; }
        if (rule.styleSheet) collectCssText(rule.styleSheet, acc, depth + 1);
        continue;
      }
      acc.text.push(rule.cssText);
    }
  }

  function inlineAllCss() {
    var acc = { text: [], failed: [], droppedImports: [] };
    Array.prototype.forEach.call(document.styleSheets, function (sheet) {
      if (sheet.href && !sameOriginHref(sheet.href)) { acc.droppedImports.push(sheet.href); return; }
      collectCssText(sheet, acc, 0);
    });
    return acc;
  }

  // Fail closed on any surviving external resource reference in the final CSS.
  // Without this, the snapshot's CSP silently blocks things the author believed
  // were inlined.
  function auditCssUrls(cssText) {
    var bad = [], re = /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, m;
    while ((m = re.exec(cssText))) {
      var u = m[2].trim();
      if (u.indexOf('data:') === 0) continue;
      if (u.charAt(0) === '#') continue;              // local SVG fragment, e.g. url(#arrowhead)
      bad.push(u);
    }
    return bad;
  }

  function sanitizeClone(root) {
    root.querySelectorAll('script').forEach(function (s) { s.remove(); });
    root.querySelectorAll('iframe, object, embed').forEach(function (s) { s.remove(); });
    root.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) { l.remove(); });
    root.querySelectorAll('.are-bar, .are-hub, .are-hub-fab, .are-results-bar, .are-send-menu, .are-toast')
        .forEach(function (n) { n.remove(); });

    var all = root.querySelectorAll('*');
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var attrs = Array.prototype.slice.call(el.attributes);
      for (var j = 0; j < attrs.length; j++) {
        var name = attrs[j].name, val = attrs[j].value;
        if (/^on/i.test(name)) { el.removeAttribute(name); continue; }
        if ((name === 'href' || name === 'src' || name === 'xlink:href') &&
            /^\s*javascript:/i.test(val)) {
          el.removeAttribute(name);
        }
      }
      // Retained external citations navigate — make them safe rather than
      // pretending they are inert.
      if (el.tagName === 'A' && el.getAttribute('href') && !sameOriginHref(el.getAttribute('href'))) {
        el.setAttribute('rel', 'noopener noreferrer');
        el.setAttribute('target', '_blank');
      }
    }
  }

  // Live form state lives in PROPERTIES, which do not serialize. Write it into
  // attributes so the frozen file renders the values it was saved with.
  function freezeFormState(root) {
    root.querySelectorAll('input').forEach(function (el) {
      if (el.type === 'checkbox' || el.type === 'radio') {
        if (el.checked) el.setAttribute('checked', 'checked'); else el.removeAttribute('checked');
      } else {
        el.setAttribute('value', el.value == null ? '' : el.value);
      }
    });
    root.querySelectorAll('textarea').forEach(function (el) {
      // A textarea's serialized default is its TEXT CONTENT, not a value attr.
      el.removeAttribute('value');
      el.textContent = el.value == null ? '' : el.value;
    });
    root.querySelectorAll('select').forEach(function (sel) {
      Array.prototype.forEach.call(sel.options, function (opt) { opt.removeAttribute('selected'); });
      var chosen = sel.options[sel.selectedIndex];
      if (chosen) chosen.setAttribute('selected', 'selected');
    });
  }

  // The clone is cloned from the LIVE document, so property state must be copied
  // element-for-element in document order (clone order matches source order).
  function copyLiveStateToClone(srcRoot, cloneRoot) {
    var src = srcRoot.querySelectorAll('input, textarea, select');
    var dst = cloneRoot.querySelectorAll('input, textarea, select');
    if (src.length !== dst.length) return false;
    for (var i = 0; i < src.length; i++) {
      var s = src[i], d = dst[i];
      if (s.type === 'checkbox' || s.type === 'radio') d.checked = s.checked;
      else if (s.tagName === 'SELECT') d.selectedIndex = s.selectedIndex;
      else d.value = s.value;
    }
    return true;
  }

  function escapeJsonForHtml(json) {
    // These are the literal six-character JSON escapes; JSON.parse restores them.
    return json.replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
  }

  function sanitizeFilename(name) {
    return String(name)
      .replace(/[\\\/:*?"<>|]/g, '')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/, '')
      .trim()
      .slice(0, 150);
  }

  function isoDate() {
    var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }

  var PRINT_TOGGLE_CSS =
    '.are-snap-radio{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}' +
    '@media print{.are-snap-radio{display:none!important}}' +
    '.are-snap-controls label{cursor:pointer;text-decoration:underline;margin-right:14px}' +
    '.are-snap-controls{font:13px/1.4 system-ui,sans-serif;padding:8px 0 12px;border-bottom:1px solid #dde;margin-bottom:12px}' +
    '.are-snap-controls label{margin-right:14px;cursor:pointer}' +
    '@media print{.are-snap-controls{display:none!important}}' +
    // General-sibling selectors only. Deliberately NOT :has() — this record must
    // stay readable in whatever browser exists years from now.
    '#are-mode-s:checked ~ .' + SNAP_WRAP_CLASS + ' .det-row{display:none!important}' +
    '#are-mode-s:checked ~ .' + SNAP_WRAP_CLASS + ' .calc-det{display:none!important}' +
    '#are-mode-s:checked ~ .' + SNAP_WRAP_CLASS + ' .blk{display:none!important}' +
    '#are-mode-s:checked ~ .' + SNAP_WRAP_CLASS + ' .dem-grid{display:none!important}' +
    '#are-mode-f:checked ~ .' + SNAP_WRAP_CLASS + ' .det-row{display:table-row!important}' +
    '#are-mode-f:checked ~ .' + SNAP_WRAP_CLASS + ' .calc-det{display:block!important}' +
    '#are-mode-f:checked ~ .' + SNAP_WRAP_CLASS + ' .step-card{display:block!important}';

  /**
   * Build the self-contained snapshot. Async and fail-closed: it throws rather
   * than emit a record that is half-offline or half-captured.
   * @returns {Promise<{filename:string, html:string, state:object}>}
   */
  AREv2.buildSnapshot = function (mode) {
    mode = mode === 's' ? 's' : 'f';
    var jobEl = document.getElementById('areJob');
    var project = jobEl ? jobEl.value.trim() : '';
    if (!project) {
      var err = new Error('Enter a Project before saving — it names the file.');
      err.code = 'NO_PROJECT';
      return Promise.reject(err);
    }

    var restoreExpansion = null;
    var capturedState = null;

    return Promise.resolve()
      .then(function () { return runAndSettle(); })
      .then(function () {
        // EXPAND-ALL BEFORE CLONING. Some calcs conditionally RENDER rather than
        // hide (stacked_headers_studs:1016 `if(fl.exp){…}`), so a collapsed floor
        // is absent from the DOM entirely and no amount of CSS can reveal it.
        // Only adapters need to expand — they handle CONDITIONAL RENDERING, where
        // collapsed content is absent from the DOM entirely.
        //
        // Do NOT call AREv2.expandAll() here. It sets inline
        // style="display:table-row !important" on every .det-row; that inline
        // rule is cloned into the saved file and beats the snapshot's own
        // stylesheet !important, so Summary could never hide detail rows — every
        // "Summary" print came out as a Full Calc. It also left the LIVE page
        // permanently expanded, breaking arePrint('s') for the rest of the
        // session. CSS-hidden content needs no expansion at all: the snapshot's
        // #are-mode-f rules force it visible in the clone.
        // Capture state BEFORE expanding. The printable record must show every
        // section, but the reloadable STATE should remember the view the
        // engineer actually had — capturing after expandAll would bake exp:true
        // into the model and silently expand every floor on reload.
        capturedState = AREv2.captureState();
        if (adapter && typeof adapter.expandAll === 'function') {
          restoreExpansion = adapter.expandAll();       // may return an undo fn
          return runAndSettle();
        }
      })
      .then(function () {
        var state = capturedState;
        if (state._problems && state._problems.length) {
          var e = new Error('Cannot capture state reliably: ' + state._problems.join('; '));
          e.code = 'AMBIGUOUS_FIELDS';
          throw e;
        }
        delete state._problems;
        state.mode = mode;

        var css = inlineAllCss();
        var cssText = css.text.join('\n');
        var badUrls = auditCssUrls(cssText);
        if (badUrls.length) {
          var e2 = new Error('Stylesheet still references external resources: ' + badUrls.slice(0, 5).join(', '));
          e2.code = 'EXTERNAL_CSS_URL';
          throw e2;
        }

        var clone = document.documentElement.cloneNode(true);
        if (!copyLiveStateToClone(document, clone)) {
          var e3 = new Error('DOM changed while snapshotting — try again.');
          e3.code = 'DOM_RACE';
          throw e3;
        }
        freezeFormState(clone);
        // Any inline display set by a previous expandAll()/arePrint() on the live
        // page would outrank the snapshot's stylesheet rules. Clear it so the
        // Summary/Full radios actually control the record.
        clone.querySelectorAll('.det-row, .calc-det, .step-card').forEach(function (el) {
          el.style.removeProperty('display');
          if (el.getAttribute('style') === '') el.removeAttribute('style');
        });
        sanitizeClone(clone);

        var head = clone.querySelector('head');
        var body = clone.querySelector('body');
        if (!head || !body) throw new Error('Malformed document clone');

        // Wrap all record content so the sibling selectors can reach nested nodes.
        var wrap = clone.ownerDocument.createElement('div');
        wrap.className = SNAP_WRAP_CLASS;
        while (body.firstChild) wrap.appendChild(body.firstChild);

        var controls = clone.ownerDocument.createElement('div');
        controls.className = 'are-snap-controls ' + SNAP_WRAP_CLASS + '-controls';
        controls.innerHTML =
          '<strong>Print:</strong> ' +
          '<label for="are-mode-s">Summary</label>' +
          '<label for="are-mode-f">Full calculation</label>';

        // The radios must be PRECEDING SIBLINGS of the content wrapper for `~` to
        // reach it, so they cannot live inside their labels. `for=` keeps the
        // labels working; `.are-snap-radio` parks them off-screen so two naked
        // radio buttons do not appear at the top of page 1 of the record.
        var mk = function (id, on) {
          var r = clone.ownerDocument.createElement('input');
          r.type = 'radio'; r.name = 'are-mode'; r.id = id;
          r.className = 'are-snap-radio';
          r.setAttribute('data-are-ignore', '');
          if (on) r.setAttribute('checked', 'checked');
          return r;
        };
        body.appendChild(mk('are-mode-s', mode === 's'));
        body.appendChild(mk('are-mode-f', mode === 'f'));
        body.appendChild(controls);
        body.appendChild(wrap);

        var meta = clone.ownerDocument.createElement('meta');
        meta.setAttribute('http-equiv', 'Content-Security-Policy');
        meta.setAttribute('content', "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src 'none'");
        head.insertBefore(meta, head.firstChild);

        var style = clone.ownerDocument.createElement('style');
        style.textContent =
          cssText + '\n' +
          "body{font-family:'DM Sans',Segoe UI,system-ui,Arial,sans-serif}\n" +
          PRINT_TOGGLE_CSS + '\n' +
          '@media print{@page{margin:.75in;size:letter portrait}}';
        head.appendChild(style);

        var json = escapeJsonForHtml(JSON.stringify(state));
        var stateEl = clone.ownerDocument.createElement('script');
        stateEl.setAttribute('type', 'application/json');
        stateEl.id = STATE_EL_ID;
        stateEl.textContent = json;
        body.appendChild(stateEl);

        var html = '<!DOCTYPE html>\n' + clone.outerHTML;

        if (/<\/script(?![^>]*type="application\/json")/i.test(html.replace(/<script type="application\/json"[^>]*>[\s\S]*?<\/script>/i, ''))) {
          var e4 = new Error('Snapshot still contains an executable script tag.');
          e4.code = 'NOT_INERT';
          throw e4;
        }
        if (html.length > MAX_SNAPSHOT_BYTES) {
          var e5 = new Error('Snapshot is ' + Math.round(html.length / 1048576) + ' MB — over the ceiling.');
          e5.code = 'TOO_LARGE';
          throw e5;
        }

        var base = sanitizeFilename(project) + ' - ' +
                   sanitizeFilename((document.title || FILE).replace(/\s*[—–|].*$/, '')) + ' - ' +
                   isoDate();
        return { filename: base + '.html', html: html, state: state };
      })
      .then(function (out) {
        if (typeof restoreExpansion === 'function') { try { restoreExpansion(); } catch (e) {} }
        return out;
      }, function (err) {
        if (typeof restoreExpansion === 'function') { try { restoreExpansion(); } catch (e) {} }
        throw err;
      });
  };

  // ── Load ──────────────────────────────────────────────────────────────────

  function validateModel(model, schema) {
    var issues = [];
    var seen = 0;
    (function walk(node, depth, path) {
      if (depth > (schema && schema.maxDepth || 12)) { issues.push('model nested too deep at ' + path); return; }
      if (++seen > (schema && schema.maxNodes || 20000)) { issues.push('model too large'); return; }
      if (node === null || typeof node === 'number' || typeof node === 'boolean') return;
      if (typeof node === 'string') {
        var max = (schema && schema.maxStringLength) || 2000;
        if (node.length > max) issues.push('string too long at ' + path);
        if (schema && schema.stringPattern && !schema.stringPattern.test(node)) {
          issues.push('disallowed characters at ' + path);
        }
        return;
      }
      if (Array.isArray(node)) { node.forEach(function (v, i) { walk(v, depth + 1, path + '[' + i + ']'); }); return; }
      if (typeof node === 'object') {
        Object.keys(node).forEach(function (k) {
          if (schema && schema.allowedKeys && schema.allowedKeys.indexOf(k) === -1 && depth === 0) {
            issues.push('unexpected key "' + k + '"');
          }
          walk(node[k], depth + 1, path + '.' + k);
        });
        return;
      }
      issues.push('unsupported value type at ' + path);
    })(model, 0, '$');
    return issues;
  }

  AREv2.parseSnapshot = function (htmlString) {
    var doc = new DOMParser().parseFromString(htmlString, 'text/html');
    var el = doc.getElementById(STATE_EL_ID);
    if (!el) { var e = new Error('This file has no saved ARE calculation state.'); e.code = 'NO_STATE'; throw e; }
    var state;
    try { state = JSON.parse(el.textContent); }
    catch (err) { var e2 = new Error('Saved state is corrupted.'); e2.code = 'BAD_JSON'; throw e2; }
    return state;
  };

  /**
   * Diff a parsed state against this page. Returns {ok, mismatches, notices}.
   * Nothing is applied unless there are zero mismatches, or force is passed.
   */
  AREv2.loadFromState = function (state, opts) {
    opts = opts || {};
    var res = { ok: false, applied: 0, mismatches: { missingOnPage: [], notInFile: [] }, notices: [] };

    if (state.schema !== SNAP_SCHEMA) {
      var e = new Error('Unsupported file format "' + state.schema + '".'); e.code = 'BAD_SCHEMA'; throw e;
    }
    if (state.calcFile !== FILE) {
      var e2 = new Error('That file was saved from "' + (state.calcTitle || state.calcFile) +
                         '". Open that calculator to load it.');
      e2.code = 'WRONG_CALC'; throw e2;
    }
    if (adapter && state.adapterVersion !== adapter.version) {
      var e3 = new Error('This calculator\'s saved-data format changed (file v' + state.adapterVersion +
                         ', calculator v' + adapter.version + ').');
      e3.code = 'ADAPTER_VERSION'; throw e3;
    }
    // shapeHash WARNS, never rejects — otherwise every deploy would orphan every
    // saved file, which is the opposite of the point. It is also only worth
    // mentioning when something actually failed to line up: rebuild-driven calcs
    // legitimately hash differently between configurations, and reporting
    // "this calculator has changed" after a flawless 8-of-8 restore is noise.
    var liveShape = shapeHash(captureFields().fields);
    var shapeDiffers = !!(state.shapeHash && state.shapeHash !== liveShape);

    if (adapter && state.model != null) {
      var issues = validateModel(state.model, adapter.schema);
      if (issues.length) {
        var e4 = new Error('Saved data failed validation: ' + issues.slice(0, 4).join('; '));
        e4.code = 'BAD_MODEL'; throw e4;
      }
    }

    var fileKeys = Object.keys(state.fields || {});

    // ── Iterative restore ────────────────────────────────────────────────────
    // Some calcs REBUILD their inputs from a configuration control — beam_calc
    // does `inputsContainer.innerHTML = ''` on beam-type change (:912), so half
    // its fields do not exist until the right type is selected. A single
    // resolve-then-apply pass would call those a mismatch. Instead: apply what
    // resolves, let the calc rebuild, apply what newly resolves, repeat until no
    // further progress. Rebuilds in these calcs are synchronous change handlers,
    // so this converges inside one synchronous call.
    //
    // The plan's guarantee — never leave the page half-populated — is preserved
    // by taking a backup first and rolling back if it fails to converge.
    var backupFields = captureFields().fields;
    var backupModel = adapter ? adapter.getModel() : null;

    function applyOne(el, v) {
      if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!v;
      else el.value = v;
      if (!isDerivedField(el)) {
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }

    function applyIteratively(keys, values) {
      var done = {}, count = 0, pass = 0, progressed = true;
      while (progressed && pass < 6) {
        progressed = false; pass++;
        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          if (done[k]) continue;
          var hits = resolveKey(k);
          if (hits.length !== 1) continue;
          applyOne(hits[0], values[k]);
          done[k] = true; count++; progressed = true;
        }
      }
      return { done: done, count: count, passes: pass };
    }

    AREv2.beginRestore();
    var applyRes;
    try {
      // If setModel throws mid-render the page is already half-mutated, so roll
      // back here too — not only on the mismatch path.
      try {
        if (adapter && state.model != null) adapter.setModel(state.model);
      } catch (modelErr) {
        try {
          if (adapter && backupModel != null) adapter.setModel(backupModel);
          applyIteratively(Object.keys(backupFields), backupFields);
        } catch (rollbackErr) {
          if (window.console) console.error('[are] rollback after setModel failure also failed', rollbackErr);
        }
        throw modelErr;
      }
      applyRes = applyIteratively(fileKeys, state.fields);
    } finally {
      AREv2.endRestore();
    }

    res.mismatches.missingOnPage = fileKeys.filter(function (k) { return !applyRes.done[k]; });
    if (!opts.skipReverseDiff) {
      allPersistableFields().forEach(function (el) {
        var k = fieldKey(el);
        if (!Object.prototype.hasOwnProperty.call(state.fields || {}, k)) res.mismatches.notInFile.push(k);
      });
    }

    var hasMismatch = res.mismatches.missingOnPage.length || res.mismatches.notInFile.length;
    if (shapeDiffers) {
      res.notices.push('This calculator has changed since the file was saved.');
    }
    if (hasMismatch && !opts.force) {
      // Roll back to exactly what the engineer had before pressing Load.
      AREv2.beginRestore();
      try {
        if (adapter && backupModel != null) adapter.setModel(backupModel);
        applyIteratively(Object.keys(backupFields), backupFields);
      } finally {
        AREv2.endRestore();
      }
      res.rolledBack = true;
      return res;
    }

    AREv2.beginRestore();
    try {
      var jobEl = document.getElementById('areJob');
      if (jobEl && state.project) jobEl.value = state.project;
      fireAfterRestore();
    } finally {
      AREv2.endRestore();
    }

    res.applied = applyRes.count;
    res.passes = applyRes.passes;
    res.ok = true;
    return res;
  };

  AREv2.loadFromHtml = function (htmlString, opts) {
    var state = AREv2.parseSnapshot(htmlString);
    var res = AREv2.loadFromState(state, opts);
    if (res.ok) return runAndSettle().then(function () { return res; });
    return Promise.resolve(res);
  };

  // ── Destination handle (IndexedDB), preloaded at init ─────────────────────
  var IDB_NAME = 'are-calcs', IDB_STORE = 'handles', IDB_KEY = 'projectDir';
  var dirHandle = null;

  function idb() {
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(IDB_NAME, 1);
      req.onupgradeneeded = function () { req.result.createObjectStore(IDB_STORE); };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
  }
  function idbGet(key) {
    return idb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(IDB_STORE, 'readonly').objectStore(IDB_STORE).get(key);
        tx.onsuccess = function () { resolve(tx.result || null); };
        tx.onerror = function () { resolve(null); };
      });
    }).catch(function () { return null; });
  }
  function idbSet(key, val) {
    return idb().then(function (db) {
      return new Promise(function (resolve) {
        var tx = db.transaction(IDB_STORE, 'readwrite').objectStore(IDB_STORE).put(val, key);
        tx.onsuccess = function () { resolve(true); };
        tx.onerror = function () { resolve(false); };
      });
    }).catch(function () { return false; });
  }

  // Reading IndexedDB is async, so it CANNOT happen inside the click handler —
  // the await would consume the transient activation the picker needs.
  function preloadDestination() {
    if (!('showDirectoryPicker' in window) || !window.indexedDB) {
      destinationReady = true; refreshToolbarState(); return;
    }
    idbGet(IDB_KEY).then(function (h) {
      if (!h) { destinationReady = true; refreshToolbarState(); return; }
      return h.queryPermission({ mode: 'readwrite' }).then(function (p) {
        if (p === 'granted') dirHandle = h;
        else dirHandle = h;              // kept; a prompt happens inside the click
        destinationReady = true; refreshToolbarState();
      });
    }).catch(function () { destinationReady = true; refreshToolbarState(); });
  }

  // Test seam: lets tools/test-activation-order.mjs exercise the
  // remembered-handle branch (where requestPermission must run inside the click)
  // without a real granted directory handle.
  AREv2._setDirHandleForTest = function (h) { dirHandle = h; destinationReady = true; };
  // Test seam: lets the QA harness compare the adapter's model before saving and
  // after reloading. Text comparison cannot do this — input VALUES do not appear
  // in innerText, so a restored row set looks empty to a text diff.
  AREv2._getAdapterModelForTest = function () { return adapter ? adapter.getModel() : null; };

  function refreshToolbarState() {
    var btn = document.getElementById('areSaveBtn');
    if (!btn) return;
    var ready = calcReady && destinationReady;
    btn.disabled = !ready;
    btn.title = ready ? 'Save this calculation into the project folder'
                      : 'Waiting for the calculator to finish loading…';
  }
  AREv2._refreshToolbarState = refreshToolbarState;

  function uniqueFileHandle(dir, filename) {
    var dot = filename.lastIndexOf('.');
    var stem = dot > 0 ? filename.slice(0, dot) : filename;
    var ext = dot > 0 ? filename.slice(dot) : '';
    var i = 1;
    function attempt(name) {
      return dir.getFileHandle(name, { create: false }).then(function () {
        i++;
        if (i > 50) throw new Error('Too many revisions of this filename.');
        return attempt(stem + ' -r' + i + ext);
      }, function (err) {
        if (err && err.name === 'NotFoundError') {
          // Advisory only: check-then-create is a race. Last write wins, as on
          // any shared folder.
          return dir.getFileHandle(name, { create: true });
        }
        throw err;
      });
    }
    return attempt(filename);
  }

  function writeHandle(handle, text) {
    return handle.createWritable().then(function (w) {
      return w.write(text).then(function () { return w.close(); });
    });
  }

  function downloadFallback(filename, text) {
    var blob = new Blob([text], { type: 'text/html;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  // ORDER IS LOAD-BEARING (PLAN.md §3): validate synchronously, acquire the
  // destination BEFORE any await, then build, then write.
  window.areSave = function (mode) {
    var jobEl = document.getElementById('areJob');
    if (!jobEl || !jobEl.value.trim()) {
      showToast('⚠ Enter a Project first — it names the saved file.', 4200);
      if (jobEl) jobEl.focus();
      return;
    }
    if (!calcReady || !destinationReady) { showToast('⏳ Still loading — try again in a moment.', 3000); return; }

    var destPromise;
    if ('showDirectoryPicker' in window) {
      if (dirHandle) {
        // requestPermission also needs activation — call it first, no awaits before it.
        destPromise = dirHandle.requestPermission({ mode: 'readwrite' }).then(function (p) {
          if (p === 'granted') return { dir: dirHandle, via: 'remembered folder' };
          return window.showDirectoryPicker({ mode: 'readwrite', id: 'are-project' })
            .then(function (h) { dirHandle = h; idbSet(IDB_KEY, h); return { dir: h, via: 'folder picker' }; });
        });
      } else {
        destPromise = window.showDirectoryPicker({ mode: 'readwrite', id: 'are-project' })
          .then(function (h) { dirHandle = h; idbSet(IDB_KEY, h); return { dir: h, via: 'folder picker' }; });
      }
    } else {
      destPromise = Promise.resolve({ dir: null, via: 'download' });
    }

    var built = AREv2.buildSnapshot(mode);

    Promise.all([destPromise.catch(function (err) {
      if (err && err.name === 'AbortError') throw err;
      return { dir: null, via: 'download (picker unavailable)' };
    }), built])
      .then(function (r) {
        var dest = r[0], snap = r[1];
        if (!dest.dir) { downloadFallback(snap.filename, snap.html); showToast('✓ Downloaded ' + snap.filename + ' (' + dest.via + ')', 5200); return; }
        return uniqueFileHandle(dest.dir, snap.filename)
          .then(function (fh) { return writeHandle(fh, snap.html).then(function () { return fh.name; }); })
          .then(function (name) { showToast('✓ Saved ' + name + ' — ' + dest.via, 5200); });
      })
      .catch(function (err) {
        if (err && err.name === 'AbortError') { showToast('Save cancelled.', 2200); return; }
        showToast('⚠ Save failed: ' + (err && err.message ? err.message : err), 7000);
        if (window.console) console.error('[are-save]', err.code || '', err);
      });
  };

  window.areSaveAs = function (mode) {
    if (!('showSaveFilePicker' in window)) return window.areSave(mode);
    var jobEl = document.getElementById('areJob');
    if (!jobEl || !jobEl.value.trim()) { showToast('⚠ Enter a Project first.', 4200); return; }
    if (!calcReady) { showToast('⏳ Still loading — try again in a moment.', 3000); return; }

    var opts = { suggestedName: 'calculation.html',
                 types: [{ description: 'ARE calculation', accept: { 'text/html': ['.html'] } }] };
    if (dirHandle) opts.startIn = dirHandle;
    var pick = window.showSaveFilePicker(opts);      // first, before any await
    var built = AREv2.buildSnapshot(mode);

    Promise.all([pick, built])
      .then(function (r) { return writeHandle(r[0], r[1].html).then(function () { return r[0].name; }); })
      .then(function (name) { showToast('✓ Saved ' + name + ' — Save as…', 5200); })
      .catch(function (err) {
        if (err && err.name === 'AbortError') { showToast('Save cancelled.', 2200); return; }
        showToast('⚠ Save failed: ' + (err && err.message ? err.message : err), 7000);
      });
  };

  function describeMismatch(res) {
    var lines = [];
    if (res.mismatches.missingOnPage.length) {
      lines.push('In the file but not on this calculator (' + res.mismatches.missingOnPage.length + '):\n  ' +
                 res.mismatches.missingOnPage.slice(0, 12).join('\n  '));
    }
    if (res.mismatches.notInFile.length) {
      lines.push('On this calculator but not in the file (' + res.mismatches.notInFile.length + '):\n  ' +
                 res.mismatches.notInFile.slice(0, 12).join('\n  '));
    }
    return lines.join('\n\n');
  }

  function handleLoadedText(text) {
    var state;
    try { state = AREv2.parseSnapshot(text); }
    catch (err) { showToast('⚠ ' + err.message, 6000); return; }

    var res;
    try { res = AREv2.loadFromState(state); }
    catch (err) { showToast('⚠ ' + err.message, 7000); return; }

    if (!res.ok) {
      var msg = 'This file does not match the calculator as it stands today.\n\n' +
                describeMismatch(res) + '\n\n' +
                'Nothing has been filled in. Load it anyway?';
      if (!window.confirm(msg)) { showToast('Load cancelled — nothing changed.', 3200); return; }
      try { res = AREv2.loadFromState(state, { force: true }); }
      catch (err) { showToast('⚠ ' + err.message, 7000); return; }
    }

    runAndSettle().then(function () {
      var extra = res.notices.length ? '  (' + res.notices.join(' ') + ')' : '';
      showToast('✓ Loaded ' + res.applied + ' fields from ' + (state.project || 'file') + extra, 5200);
    });
  }

  // Calcs whose inputs are owned by a framework (React) cannot be restored by
  // setting DOM values — the component ignores it and the results panel would
  // keep showing numbers computed from the OLD inputs while the boxes display
  // the new ones. Until those calcs have in-component adapters, Load is refused
  // outright rather than silently lying. Save still works: the snapshot is a
  // frozen post-run DOM and remains a truthful record.
  var loadDisabledReason = null;
  AREv2.disableLoad = function (reason) {
    loadDisabledReason = reason || 'Load is not available on this calculator.';
    var b = document.getElementById('areLoadBtn');
    if (b) { b.disabled = true; b.title = loadDisabledReason; }
  };

  window.areLoad = function () {
    if (loadDisabledReason) { showToast('⚠ ' + loadDisabledReason, 7000); return; }
    // Same exposure as Save: loading before an async shape database lands lets
    // applyDb() repopulate the selects afterwards and reset the section to its
    // default — silently changing the calculated member.
    if (!calcReady) { showToast('⏳ Still loading — try again in a moment.', 3000); return; }
    if ('showOpenFilePicker' in window) {
      var opts = { multiple: false, types: [{ description: 'ARE calculation', accept: { 'text/html': ['.html'] } }] };
      if (dirHandle) opts.startIn = dirHandle;
      window.showOpenFilePicker(opts)
        .then(function (handles) { return handles[0].getFile(); })
        .then(function (file) { return file.text(); })
        .then(handleLoadedText)
        .catch(function (err) {
          if (err && err.name === 'AbortError') return;
          showToast('⚠ Could not open that file: ' + (err && err.message ? err.message : err), 6000);
        });
      return;
    }
    var input = document.createElement('input');
    input.type = 'file'; input.accept = '.html,text/html';
    input.onchange = function () {
      var f = input.files && input.files[0];
      if (f) f.text().then(handleLoadedText);
    };
    input.click();
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectTheme();
    injectPrintRules();
    injectToolbar();
    injectHSSChooser();
    injectHub();
    applyTransferIfAny();
    setTimeout(function(){ AREv2.normalizeSelects(); }, 600);

    // Preload the saved destination handle and its permission state NOW, so the
    // Save click handler can read a plain variable instead of awaiting IndexedDB
    // and losing its transient user activation.
    preloadDestination();

    // Calcs with async data call AREv2.ready(promise) or register an adapter
    // carrying one. Everything else is ready as soon as init runs. Only default
    // to ready when the calc has NOT taken responsibility itself.
    if (!readyDeclared) calcReady = true;
    refreshToolbarState();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
