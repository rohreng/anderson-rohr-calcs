# Flange-Plated Moment Connection to HSS Column — Implementation Plan

Spec: `docs/superpowers/specs/2026-09-22-flange-plated-hss-moment-connection-design.md`. Pattern: `seated_beam_connection_calculator.html` (2026-09-07).

## Tasks

1. **Section databases** — pull W8–W36 and rectangular HSS (B, H 4–20 in) from `RE CODING/Steel/aisc-shapes-database-v16.0.xlsx` (imperial block = first occurrence of each header), emit `W_DB` / `HSS_DB` JS objects. Done by script into the calc file.
2. **Engine** `window.FPHSS` — validation, flange forces, per-plate beam-side rows (spec §4.2–4.3), per-plate column rows (spec §4.4), summary, fixtures F1–F7 (spec §6 plus a Chapter E branch and a validation case). DOM-free; `node --check` on each script block; fixtures run in node by evaluating the engine block with a stub `window`.
3. **UI** — header, inline SVG (elevation + plan), four input blocks with static ids, live re-run, error box, banner / demand cards / properties / grouped check table / advisory / assumptions / provenance, `?selftest=1`, `are-utils-v2.js data-no-theme` last.
4. **Registration** — `app/lib/calcs.ts` entry in the HSS Connections group; `public/are-utils-v2.js` `HSS_FAMILY` + `CALC_SLUG_MAP`; `package.json` `test:fphss` and the `qa` chain; `node tools/derive-coverage.mjs --write`.
5. **Node test** `tools/test-flange-plated-hss.mjs` — fixtures in headless Chromium from disk, defaults run, banner matches engine, live re-run, error path, T/X × directional modes, section selects, selftest title, zero page errors.
6. **Verification** — `npm run test:fphss`; `node tools/derive-coverage.mjs`; browser preview from `public/` root: run defaults, expand panels, print view.
7. **Docs** — `docs/flange-plated-hss-hand-check-2026-09.md` with the fixture table and source pages; copy of the calc to `RE CODING/Steel/`.
8. **Deploy** — commit via `/tmp/are-git` (core.worktree = OneDrive repo), push; Vercel builds. Only after Nick's review of the page.
