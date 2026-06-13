// =============================================================================
// ARE Calc-State Loader — v1
// -----------------------------------------------------------------------------
// Drop-in helper a calc HTML page can include to hydrate from a saved Calc
// State. It reads ?id= from its OWN location, fetches /api/calc/<id>
// (same-origin — a logged-in user's Clerk cookie authorizes the GET), and
// dispatches a CustomEvent 'are:stateLoaded' carrying the full envelope so the
// calc can populate its inputs and auto-run.
//
//   Usage in a calc page:
//     <script src="/are-state-loader.js"></script>
//     window.addEventListener('are:stateLoaded', function (e) {
//       var state = e.detail;            // the full Calc State envelope
//       // ...map state.member / state.demands / state.connection to inputs,
//       //    then trigger the calc's run/recalc function.
//     });
//
// NOTE: Wiring each calc to CONSUME this event (mapping fields + auto-running)
// is deliberately left as follow-up work — this loader only fetches and
// broadcasts. It is a no-op when there is no ?id= in the URL.
// =============================================================================
(function () {
  "use strict";

  // ── Read ?id= from this page's own location ───────────────────────────────
  function getId() {
    try {
      var params = new URLSearchParams(window.location.search);
      var id = params.get("id");
      if (!id) return null;
      id = id.trim();
      // Basic uuid shape guard (8-4-4-4-12 hex). Avoids firing on junk.
      return /^[0-9a-fA-F-]{36}$/.test(id) ? id : null;
    } catch (e) {
      return null;
    }
  }

  function dispatch(name, detail) {
    try {
      window.dispatchEvent(new CustomEvent(name, { detail: detail }));
    } catch (e) {
      // Older engines: fall back to manual construction.
      var evt = document.createEvent("CustomEvent");
      evt.initCustomEvent(name, false, false, detail);
      window.dispatchEvent(evt);
    }
  }

  function load() {
    var id = getId();
    if (!id) return; // nothing to hydrate — no-op

    // Same-origin GET; credentials:'include' sends the Clerk session cookie so
    // a logged-in user's request is authorized (spec §5.4).
    fetch("/api/calc/" + encodeURIComponent(id), {
      method: "GET",
      credentials: "include",
      headers: { Accept: "application/json" },
    })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("GET /api/calc/" + id + " -> " + res.status);
        }
        return res.json();
      })
      .then(function (state) {
        // Broadcast the loaded state. Consumers map fields + auto-run.
        dispatch("are:stateLoaded", state);
      })
      .catch(function (err) {
        // Broadcast the failure too, so a page can show a notice if it cares.
        dispatch("are:stateLoadError", {
          id: id,
          message: err && err.message ? err.message : String(err),
        });
        if (window.console && console.warn) {
          console.warn("[are-state-loader]", err);
        }
      });
  }

  // Expose for manual re-trigger and run once on DOM ready.
  window.AREStateLoader = { load: load, getId: getId };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", load, { once: true });
  } else {
    load();
  }
})();
