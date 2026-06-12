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

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    injectTheme();
    injectPrintRules();
    injectToolbar();
    injectHSSChooser();
    injectHub();
    applyTransferIfAny();
    setTimeout(function(){ AREv2.normalizeSelects(); }, 600);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
