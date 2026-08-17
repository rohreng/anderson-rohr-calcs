// =============================================================================
// Known console noise, shared by every QA tool so the patterns live in ONE place.
// =============================================================================

// Failures that exist in the calculator today, independent of save/load. Listed
// so they are REPORTED as pre-existing rather than silently passing or being
// blamed on this feature. PLAN.md puts calculator logic out of scope.
export const PREEXISTING = {
  // Drawing code emits NaN geometry for some input states. Pre-existing at HEAD;
  // the file is untouched by this feature. Tracked separately as its own fix.
  'through_plate_calculator.html': [
    /<(rect|line|circle|path)> attribute [a-z0-9_-]+: Expected (length|number|"[^"]*")/i,
    /Expected length, "NaN"/i,
  ],
};

// Third-party noise that is not this project's concern.
export const BENIGN = [
  /ReactDOM\.render is no longer supported/i,
  /in-browser Babel transformer/i,
  /cdn\.tailwindcss\.com should not be used in production/i,
  // Unattributed duplicate of a failed request. Each tool's `response` listener
  // is the authoritative same-origin check and reports the actual URL, so a real
  // same-origin failure still fails the run.
  /^Failed to load resource/i,
];

export const isBenign = (m) => BENIGN.some((re) => re.test(m));
export const isPreexisting = (file, m) => (PREEXISTING[file] || []).some((re) => re.test(m));
