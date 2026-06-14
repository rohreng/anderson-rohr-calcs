/*
 * are-calc.js — Anderson Rohr Engineers | Calc Utility Helpers
 *
 * Provides ARE.formulaBlock() for generating algebraic formula display elements.
 * New calculators can use this to render the symbolic → substitution → result pattern.
 *
 * Usage:
 *   const el = ARE.formulaBlock(
 *     "φPn = φ · Fcr · Ag",
 *     "= 0.90 × 36.45 ksi × 4.02 in²",
 *     "= 131.9 kips",
 *     "pass"
 *   );
 *   document.getElementById("results").appendChild(el);
 */

(function () {
  "use strict";

  var ARE = window.ARE || {};

  /**
   * Create an .are-formula block element.
   *
   * @param {string} sym    Symbolic formula line:  "φPn = φ · Fcr · Ag"
   * @param {string} sub    Substituted values:     "= 0.90 × 36.45 ksi × 4.02 in²"
   * @param {string} result Numeric result line:    "= 131.9 kips"
   * @param {"pass"|"warn"|"fail"|""} status  Status token appended to result line
   * @returns {HTMLDivElement}
   */
  ARE.formulaBlock = function (sym, sub, result, status) {
    var suffix = status === "pass" ? " ✓" : status === "fail" ? " ✗" : "";

    var wrapper = document.createElement("div");
    wrapper.className = "are-formula";

    var symEl = document.createElement("div");
    symEl.className = "are-formula-sym";
    symEl.innerHTML = sym;

    var subEl = document.createElement("div");
    subEl.className = "are-formula-sub";
    subEl.innerHTML = sub;

    var resultEl = document.createElement("div");
    resultEl.className = "are-formula-result" + (status ? " are-" + status : "");
    resultEl.innerHTML = result + suffix;

    wrapper.appendChild(symEl);
    wrapper.appendChild(subEl);
    wrapper.appendChild(resultEl);

    return wrapper;
  };

  /**
   * Render a formula block directly into a container element.
   *
   * @param {string|HTMLElement} container  CSS selector or DOM element
   * @param {string} sym
   * @param {string} sub
   * @param {string} result
   * @param {"pass"|"warn"|"fail"|""} status
   */
  ARE.renderFormula = function (container, sym, sub, result, status) {
    var el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;
    el.appendChild(ARE.formulaBlock(sym, sub, result, status));
  };

  /**
   * Update an .are-result block's value and status.
   *
   * @param {string|HTMLElement} container
   * @param {string} value    Display value string (e.g. "131.9")
   * @param {string} unit     Unit string (e.g. "kips")
   * @param {"pass"|"warn"|"fail"|""} status
   */
  ARE.setResult = function (container, value, unit, status) {
    var el = typeof container === "string" ? document.querySelector(container) : container;
    if (!el) return;

    var valueEl = el.querySelector(".are-result-value");
    var unitEl = el.querySelector(".are-result-unit");

    if (valueEl) valueEl.textContent = value;
    if (unitEl && unit !== undefined) unitEl.textContent = unit;

    el.classList.remove("are-pass", "are-warn", "are-fail");
    if (status) el.classList.add("are-" + status);
  };

  window.ARE = ARE;
})();
