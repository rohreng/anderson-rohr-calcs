// =============================================================================
// ARE Calculator Shared Utilities  —  v1.0
// Save/Load inputs via localStorage · Print Summary · Print Full Calc
// Inject this script into any ARE calculator HTML file.
// =============================================================================

(function () {
  'use strict';

  // Storage key is unique per calculator file
  var STORE_KEY = 'are_v1_' + (window.location.pathname.split('/').pop() || 'calc');

  // ── 1. Inject Styles ───────────────────────────────────────────────────────

  function injectStyles() {
    var css = [

      // ── Toolbar ──────────────────────────────────────────────────────────
      '.are-bar{',
        'display:flex;align-items:center;gap:8px;padding:6px 14px;',
        'background:#fff;border-bottom:2px solid #1e3c72;',
        'position:sticky;top:0;z-index:9999;flex-wrap:wrap;',
        'font-family:system-ui,Arial,sans-serif;',
        'box-shadow:0 1px 5px rgba(30,60,114,.10);',
      '}',
      '.are-bar label{font-size:11px;font-weight:700;color:#1e3c72;white-space:nowrap;letter-spacing:.03em}',
      '.are-bar-job{',
        'border:1.5px solid #c7d2e0;border-radius:4px;',
        'padding:4px 9px;font-size:12px;color:#1a1a1a;',
        'width:210px;outline:none;transition:border-color .15s;',
      '}',
      '.are-bar-job:focus{border-color:#1e3c72}',
      '.are-bar-sep{width:1px;height:22px;background:#dde;margin:0 3px;flex-shrink:0}',
      '.are-btn{',
        'border:1.5px solid #1e3c72;background:#fff;color:#1e3c72;',
        'border-radius:4px;padding:4px 12px;font-size:11px;font-weight:700;',
        'cursor:pointer;white-space:nowrap;letter-spacing:.02em;',
        'transition:background .12s,color .12s;font-family:inherit;',
      '}',
      '.are-btn:hover{background:#1e3c72;color:#fff}',
      '.are-btn.pr{border-color:#2a5298;color:#2a5298}',
      '.are-btn.pr:hover{background:#2a5298;color:#fff}',
      '.are-spacer{flex:1;min-width:8px}',

      // ── Toast notification ────────────────────────────────────────────────
      '.are-toast{',
        'position:fixed;bottom:20px;right:20px;',
        'background:#1e3c72;color:#fff;',
        'padding:9px 18px;border-radius:6px;',
        'font-size:13px;font-family:system-ui,Arial,sans-serif;',
        'z-index:99999;opacity:0;transition:opacity .2s;',
        'pointer-events:none;box-shadow:0 2px 10px rgba(0,0,0,.25);',
      '}',
      '.are-toast.show{opacity:1}',

      // ── Print-only header (hidden on screen) ──────────────────────────────
      '.are-ph{display:none}',

      // ── Print media query ─────────────────────────────────────────────────
      '@media print{',

        // Always hide
        '.are-bar{display:none!important}',
        'button,.calc-btn,.det-btn,.btn-ra,.are-bar{display:none!important}',

        // Show print header
        '.are-ph{',
          'display:block!important;',
          'border-bottom:2px solid #1e3c72;',
          'padding-bottom:8px;margin-bottom:14px;',
          'font-family:system-ui,Arial,sans-serif;',
        '}',
        '.are-ph-title{font-size:15px;font-weight:700;color:#1e3c72;margin:0 0 3px}',
        '.are-ph-meta{font-size:11px;color:#555;margin:0}',

        // Results always visible when printing
        '.results,.results-section{display:block!important}',

        // — Summary mode (data-pm="s") ————————————————————————————————————
        // Hide input blocks, floor inputs, demand cards, detail panels
        'body[data-pm="s"] .blk{display:none!important}',
        'body[data-pm="s"] .floor-blk{display:none!important}',
        'body[data-pm="s"] #floor-con{display:none!important}',
        'body[data-pm="s"] .dem-grid{display:none!important}',
        'body[data-pm="s"] .det-row{display:none!important}',
        'body[data-pm="s"] .calc-btn{display:none!important}',
        // Keep check table and summary visible
        'body[data-pm="s"] .chk-table{display:table!important}',
        'body[data-pm="s"] .summary{display:block!important}',
        'body[data-pm="s"] #sumBox{display:block!important}',

        // — Full mode (data-pm="f") ——————————————————————————————————————
        // Show expanded detail rows
        'body[data-pm="f"] .det-row{display:table-row!important}',
        'body[data-pm="f"] .calc-det{display:block!important}',

        // Page setup
        '@page{margin:.75in;size:letter portrait}',

      '}', // end @media print

    ].join('');

    var el = document.createElement('style');
    el.id = 'are-utils-styles';
    el.textContent = css;
    document.head.appendChild(el);
  }

  // ── 2. Inject Toolbar ─────────────────────────────────────────────────────

  function injectToolbar() {
    // Toolbar
    var bar = document.createElement('div');
    bar.className = 'are-bar';
    bar.id = 'areBar';
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

    // Print-only header block (right after toolbar, before calc content)
    var ph = document.createElement('div');
    ph.className = 'are-ph';
    ph.id = 'arePH';
    ph.innerHTML =
      '<div class="are-ph-title" id="arePHtitle">' + document.title + '</div>' +
      '<div class="are-ph-meta" id="arePHmeta"></div>';
    bar.insertAdjacentElement('afterend', ph);

    // Toast element
    var toast = document.createElement('div');
    toast.className = 'are-toast';
    toast.id = 'areToast';
    document.body.appendChild(toast);

    // Restore saved job name on load (non-intrusively — don't auto-fill inputs)
    try {
      var saved = localStorage.getItem(STORE_KEY);
      if (saved) {
        var d = JSON.parse(saved);
        if (d._job) document.getElementById('areJob').value = d._job;
      }
    } catch (e) { /* ignore */ }
  }

  // ── 3. Toast helper ────────────────────────────────────────────────────────

  function showToast(msg, ms) {
    var el = document.getElementById('areToast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, ms || 2600);
  }

  // ── 4. Save ────────────────────────────────────────────────────────────────

  window.areSave = function () {
    var job = '';
    var jobEl = document.getElementById('areJob');
    if (jobEl) job = jobEl.value.trim();

    var inputs = {};
    document.querySelectorAll('input[id], select[id], textarea[id]').forEach(function (el) {
      if (el.id === 'areJob') return;
      if (el.type === 'file') return;
      inputs[el.id] = el.type === 'checkbox' ? el.checked : el.value;
    });

    var payload = { _job: job, _ts: Date.now(), _inputs: inputs };

    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(payload));
      showToast('✓ Saved' + (job ? ' — ' + job : ''));
    } catch (e) {
      showToast('⚠ Save failed: storage may be full.');
    }
  };

  // ── 5. Load ────────────────────────────────────────────────────────────────

  window.areLoad = function () {
    var raw = localStorage.getItem(STORE_KEY);
    if (!raw) {
      showToast('No saved inputs found for this calculator.', 3200);
      return;
    }

    var data;
    try { data = JSON.parse(raw); }
    catch (e) { showToast('⚠ Could not read saved data.', 3200); return; }

    // Restore job name
    var jobEl = document.getElementById('areJob');
    if (jobEl && data._job) jobEl.value = data._job;

    // Restore all inputs
    var count = 0;
    Object.keys(data._inputs || {}).forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!data._inputs[id];
      } else {
        el.value = data._inputs[id];
      }
      // Dispatch events so dependent UI updates (e.g. updatePlan())
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      count++;
    });

    // Auto-run calculations
    if (typeof runCalcs === 'function') { runCalcs(); }
    else if (typeof runAll === 'function') { runAll(); }
    else if (typeof calculate === 'function') { calculate(); }
    else if (typeof calcAll === 'function') { calcAll(); }

    var d = new Date(data._ts);
    var ds = d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    showToast('✓ Loaded' + (data._job ? ' — ' + data._job : '') + '  (saved ' + ds + ')');
  };

  // ── 6. Print ───────────────────────────────────────────────────────────────

  window.arePrint = function (mode) {
    // Update print header
    var metaEl = document.getElementById('arePHmeta');
    if (metaEl) {
      var jobEl = document.getElementById('areJob');
      var jobStr = (jobEl && jobEl.value.trim()) ? jobEl.value.trim() + '  ·  ' : '';
      metaEl.textContent = jobStr + 'Anderson Rohr Engineers  ·  ' + new Date().toLocaleDateString();
    }

    if (mode === 'f') {
      // Expand all detail rows and panels before printing
      document.querySelectorAll('.det-row').forEach(function (el) {
        el.style.setProperty('display', 'table-row', 'important');
      });
      document.querySelectorAll('.calc-det').forEach(function (el) {
        el.style.setProperty('display', 'block', 'important');
      });
    }

    document.body.setAttribute('data-pm', mode);
    window.print();
    document.body.removeAttribute('data-pm');

    if (mode === 'f') {
      // Restore collapsed state
      document.querySelectorAll('.det-row').forEach(function (el) {
        el.style.removeProperty('display');
      });
      document.querySelectorAll('.calc-det').forEach(function (el) {
        el.style.removeProperty('display');
      });
    }
  };

  // ── 7. Init ────────────────────────────────────────────────────────────────

  function init() {
    injectStyles();
    injectToolbar();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
