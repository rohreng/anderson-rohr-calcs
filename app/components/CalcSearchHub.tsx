"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { CALCS, type CalcMeta } from "../lib/calcs";

// ─── Status badge config ──────────────────────────────────────────────────────

const STATUS: Record<CalcMeta["status"], { label: string; bg: string; color: string }> = {
  ready:   { label: "Ready",       bg: "#eaf4ee", color: "var(--are-ok)" },
  wip:     { label: "In Progress", bg: "#fdf4dc", color: "var(--are-warn)" },
  planned: { label: "Planned",     bg: "#f0f2f7", color: "var(--are-muted)" },
};

// ─── Search helpers ───────────────────────────────────────────────────────────

function buildSearchIndex(calc: CalcMeta): string {
  return [calc.label, calc.subtitle, calc.category, calc.spec, calc.group ?? "", ...(calc.keywords ?? [])]
    .join(" ")
    .toLowerCase();
}

function filterCalcs(calcs: CalcMeta[], query: string): CalcMeta[] {
  const q = query.trim().toLowerCase();
  if (!q) return calcs;
  const terms = q.split(/\s+/);
  return calcs.filter((c) => {
    const idx = buildSearchIndex(c);
    return terms.every((t) => idx.includes(t));
  });
}

// ─── Grouping helper ──────────────────────────────────────────────────────────

type RenderItem =
  | { kind: "card"; calc: CalcMeta }
  | { kind: "group"; label: string; calcs: CalcMeta[] };

function buildRenderList(calcs: CalcMeta[]): RenderItem[] {
  const list: RenderItem[] = [];
  const seenGroups = new Set<string>();
  for (const calc of calcs) {
    if (!calc.group) {
      list.push({ kind: "card", calc });
    } else if (!seenGroups.has(calc.group)) {
      seenGroups.add(calc.group);
      list.push({ kind: "group", label: calc.group, calcs: calcs.filter((c) => c.group === calc.group) });
    }
  }
  return list;
}

// ─── CalcSearchHub ────────────────────────────────────────────────────────────

export default function CalcSearchHub() {
  const [query, setQuery] = useState("");
  const isSearching = query.trim().length > 0;

  const filteredCalcs = useMemo(() => filterCalcs(CALCS, query), [query]);
  const categories = useMemo(() => [...new Set(CALCS.map((c) => c.category))], []);

  return (
    /* golden ratio: min(340px, 38%) cap keeps brand column proportional across viewport widths */
    <div className="grid" style={{ gridTemplateColumns: "min(340px, 38%) 1fr", alignItems: "start" }}>

      {/* ── Brand column ──────────────────────────────────────────────── */}
      <aside
        className="border-r pr-10"
        style={{
          borderColor: "var(--are-border-soft)",
          position: "sticky",
          /* sticky brand column: search stays accessible as the calc grid scrolls */
          top: "calc(var(--header-height) + 2.5rem)",
          alignSelf: "start",
        }}
      >
        {/* Firm name — Archivo 800, 30px. NOT an eyebrow: real h2, real weight, real size */}
        <h2
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "1.875rem",
            fontWeight: 800,
            lineHeight: 1.05,
            letterSpacing: "-0.025em",
            color: "var(--are-navy)",
            marginBottom: "0.75rem",
          }}
        >
          Anderson Rohr
          <br />
          Engineers
        </h2>

        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "0.9375rem",
            fontWeight: 400,
            lineHeight: 1.55,
            color: "var(--are-muted)",
            marginBottom: "1.25rem",
            maxWidth: "28ch",
          }}
        >
          AISC 360-22 &amp; ACI 318-19 structural design calculators — live in the browser.
        </p>

        {/* Spec badges — moved from Header so they anchor the brand column context */}
        <div className="flex flex-wrap gap-2 mb-7">
          {["AISC 360-22", "ACI 318-19"].map((spec) => (
            <span
              key={spec}
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.6875rem",
                fontWeight: 600,
                letterSpacing: "0.07em",
                textTransform: "uppercase",
                color: "var(--are-muted)",
                background: "var(--are-warmwhite)",
                border: "1px solid var(--are-border)",
                borderRadius: "0.25rem",
                padding: "0.25rem 0.625rem",
              }}
            >
              {spec}
            </span>
          ))}
        </div>

        {/* Search — sr-only label + CSS focus ring; no outline-none, no JS onFocus/onBlur */}
        <div className="relative mb-2">
          <label htmlFor="calc-search" className="sr-only">
            Search calculators
          </label>
          <span
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none select-none"
            style={{ color: "var(--are-muted)", fontSize: "0.9375rem" }}
          >
            ⌕
          </span>
          <input
            id="calc-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search — anchor bolt, diaphragm…"
            className="w-full pl-8 py-2.5 rounded-md border text-sm are-focus-ring"
            style={{
              paddingRight: isSearching ? "2.25rem" : "0.75rem",
              background: "var(--are-surface)",
              borderColor: "var(--are-border)",
              color: "var(--are-navy)",
              fontFamily: "var(--font-dm-sans)",
            }}
          />
          {isSearching && (
            <button
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 are-focus-ring rounded px-1"
              style={{
                color: "var(--are-muted)",
                fontSize: "0.625rem",
                lineHeight: 1,
                background: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">✕</span>
            </button>
          )}
        </div>

        {isSearching && (
          <p className="text-xs" style={{ color: "var(--are-muted)", fontFamily: "var(--font-dm-sans)" }}>
            {filteredCalcs.length === 0
              ? "No calculators matched."
              : `${filteredCalcs.length} calculator${filteredCalcs.length === 1 ? "" : "s"} found`}
          </p>
        )}
      </aside>

      {/* ── Calc grid ─────────────────────────────────────────────────── */}
      <div className="pl-10">
        {isSearching ? (
          <section aria-label="Search results">
            {filteredCalcs.length === 0 ? (
              <EmptyState query={query} onClear={() => setQuery("")} />
            ) : (
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                {filteredCalcs.map((calc) => (
                  <CalcCard key={calc.slug} calc={calc} showCategory />
                ))}
              </div>
            )}
          </section>
        ) : (
          <>
            {categories.map((cat) => {
              const catCalcs = CALCS.filter((c) => c.category === cat);
              const renderList = buildRenderList(catCalcs);
              const catId = `cat-${cat.replace(/[^\w]+/g, "-").toLowerCase()}`;
              return (
                <section key={cat} className="mb-10" aria-labelledby={catId}>
                  <div className="flex items-center gap-4 mb-4">
                    {/* taste-skill: Archivo 600 normal-case subheading — not a 10px uppercase eyebrow */}
                    <h3
                      id={catId}
                      className="shrink-0"
                      style={{
                        fontFamily: "var(--font-archivo)",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                        color: "var(--are-navy)",
                        letterSpacing: 0,
                      }}
                    >
                      {cat}
                    </h3>
                    <div className="flex-1 h-px" style={{ background: "var(--are-border-soft)" }} />
                  </div>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
                    {renderList.map((item) =>
                      item.kind === "card" ? (
                        <CalcCard key={item.calc.slug} calc={item.calc} />
                      ) : (
                        <GroupCard key={item.label} label={item.label} calcs={item.calcs} />
                      )
                    )}
                  </div>
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div
      className="rounded-md border p-8 text-center"
      style={{ background: "var(--are-surface)", borderColor: "var(--are-border)" }}
    >
      <p className="text-sm mb-2" style={{ color: "var(--are-charcoal-lt)", fontFamily: "var(--font-dm-sans)" }}>
        No calculators matched &ldquo;{query}&rdquo;.
      </p>
      <button
        onClick={onClear}
        className="text-xs underline are-focus-ring rounded"
        style={{ color: "var(--are-navy-mid)", background: "none", border: "none", cursor: "pointer" }}
      >
        Clear search
      </button>
    </div>
  );
}

// ─── CalcCard — status-tiered visual weight ───────────────────────────────────

function CalcCard({ calc, showCategory = false }: { calc: CalcMeta; showCategory?: boolean }) {
  const badge = STATUS[calc.status];

  const cardBg =
    calc.status === "planned" ? "var(--are-offwhite)"  /* ghost */
    : calc.status === "wip"    ? "#fdf8f2"              /* amber tint */
    :                            "var(--are-surface)";  /* full white */

  const inner = (
    <div
      className={[
        "rounded-md border p-5 flex flex-col gap-3 h-full",
        /* Emil: hover lift on ready cards only — ease-out 150ms; not for wip/planned */
        calc.status === "ready" ? "group-hover:-translate-y-0.5 group-hover:shadow-md" : "",
      ].join(" ").trim()}
      style={{
        background: cardBg,
        borderColor: calc.status === "planned" ? "var(--are-border-soft)" : "var(--are-border)",
        /* top accent: navy for ready, amber for wip, none for planned */
        borderTopWidth: calc.status !== "planned" ? 2 : undefined,
        borderTopColor:
          calc.status === "ready" ? "var(--are-navy)"
          : calc.status === "wip"   ? "var(--are-warn)"
          : undefined,
        /* Emil: ease-out 150ms on ready only; prefers-reduced-motion global rule strips this */
        transition: calc.status === "ready"
          ? "transform 150ms cubic-bezier(0,0,0.2,1), box-shadow 150ms cubic-bezier(0,0,0.2,1)"
          : undefined,
        cursor: calc.status === "planned" ? "default" : "pointer",
      }}
    >
      {/* Category tag — shown in search results to orient the user in the flat list */}
      {showCategory && (
        <span
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.625rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--are-navy-light)",
          }}
        >
          {calc.category}{calc.group ? ` · ${calc.group}` : ""}
        </span>
      )}

      {/* Title + status badge */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className="font-semibold leading-snug"
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.9375rem",
            color: calc.status === "planned" ? "var(--are-charcoal-lt)" : "var(--are-navy)",
          }}
        >
          {calc.label}
        </h4>
        <span
          className="shrink-0 rounded px-2 py-0.5"
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.5625rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            background: badge.bg,
            color: badge.color,
          }}
        >
          {badge.label}
        </span>
      </div>

      {/* Subtitle — DM Sans 400, 14px; --are-muted passes 4.5:1 after token fix */}
      <p
        className="leading-relaxed flex-1"
        style={{
          fontFamily: "var(--font-dm-sans)",
          fontSize: "0.875rem",
          color: "var(--are-muted)",
        }}
      >
        {calc.subtitle}
      </p>

      {/* Spec tag + open link */}
      <div className="flex items-center justify-between">
        <span
          className="rounded border px-2 py-0.5"
          style={{
            fontFamily: "var(--font-archivo)",
            fontSize: "0.6875rem",
            fontWeight: 600,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            borderColor: "var(--are-border)",
            color: "var(--are-muted)",
          }}
        >
          {calc.spec}
        </span>
        {calc.status !== "planned" && (
          <span
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: calc.status === "wip" ? "var(--are-warn)" : "var(--are-navy-mid)",
            }}
          >
            Open →
          </span>
        )}
      </div>
    </div>
  );

  /* Planned: ghost div — no link, no interactive affordance */
  if (calc.status === "planned") {
    return <div aria-disabled="true">{inner}</div>;
  }

  return (
    <Link href={`/calcs/${calc.slug}`} className="block group are-focus-ring rounded-md">
      {inner}
    </Link>
  );
}

// ─── GroupCard ────────────────────────────────────────────────────────────────

function GroupCard({ label, calcs }: { label: string; calcs: CalcMeta[] }) {
  const spec = calcs[0]?.spec ?? "";

  return (
    <details
      className="rounded-md border overflow-hidden"
      style={{
        background: "var(--are-surface)",
        borderColor: "var(--are-border)",
        borderTopWidth: 2,
        borderTopColor: "var(--are-navy)",
      }}
    >
      {/* are-details-summary: inset focus outline — overflow-hidden clips box-shadow rings */}
      <summary
        className="flex flex-col gap-3 p-5 cursor-pointer list-none select-none are-details-summary"
        style={{ WebkitAppearance: "none" } as React.CSSProperties}
      >
        {/* Title + variant count */}
        <div className="flex items-start justify-between gap-2">
          <h4
            className="font-semibold leading-snug"
            style={{ fontFamily: "var(--font-archivo)", fontSize: "0.9375rem", color: "var(--are-navy)" }}
          >
            {label}
          </h4>
          <span
            className="shrink-0 rounded px-2 py-0.5"
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.5625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              background: "#eaf4ee",
              color: "var(--are-ok)",
            }}
          >
            {calcs.length} variants
          </span>
        </div>

        {/* Variant names preview */}
        <p
          className="leading-relaxed flex-1"
          style={{ fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem", color: "var(--are-muted)" }}
        >
          {calcs.map((c) => c.label).join(" · ")}
        </p>

        {/* Spec tag + expand hint */}
        <div className="flex items-center justify-between">
          <span
            className="rounded border px-2 py-0.5"
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.6875rem",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              borderColor: "var(--are-border)",
              color: "var(--are-muted)",
            }}
          >
            {spec}
          </span>
          <span
            style={{
              fontFamily: "var(--font-archivo)",
              fontSize: "0.625rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--are-navy-mid)",
            }}
          >
            Select ▾
          </span>
        </div>
      </summary>

      {/* Expanded variant list */}
      <div className="border-t flex flex-col" style={{ borderColor: "var(--are-border)" }}>
        {calcs.map((calc, idx) => (
          <Link
            key={calc.slug}
            href={`/calcs/${calc.slug}`}
            className="flex items-center justify-between px-5 py-3 are-details-summary transition-colors hover:bg-[var(--are-offwhite)]"
            style={idx < calcs.length - 1 ? { borderBottom: "1px solid var(--are-border-soft)" } : undefined}
          >
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <span
                className="text-sm font-semibold"
                style={{ color: "var(--are-navy)", fontFamily: "var(--font-archivo)" }}
              >
                {calc.label}
              </span>
              <span
                style={{ color: "var(--are-muted)", fontFamily: "var(--font-dm-sans)", fontSize: "0.875rem" }}
              >
                {calc.subtitle}
              </span>
            </div>
            <span
              className="ml-4 shrink-0"
              style={{
                fontFamily: "var(--font-archivo)",
                fontSize: "0.625rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--are-navy-mid)",
              }}
            >
              Open →
            </span>
          </Link>
        ))}
      </div>
    </details>
  );
}
